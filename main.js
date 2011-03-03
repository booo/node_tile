var config = require('./config')	//include config file
var mapnik = require('mapnik')
var TC = require('./node-tokyocabinet/build/default/tokyocabinet')
var path = require('path')
var clutch = require('clutch')
var mercator = require('mapnik/sphericalmercator')
var mappool = require('mapnik/pool')
var http = require('http')


var maps = mappool.create(2);

console.log("Tokyo Cabinet version " + TC.VERSION);
var HDB = TC.HDB;
var hdb = new HDB;

if (!hdb.open(config.cacheFile, HDB.OWRITER | HDB.OCREAT)) {
    sys.error(hdb.errmsg());
}
function writeResponse(content, res) {
	res.writeHead(200, {
                        'Content-Type': 'image/png',
                        'ETag' : content.ETag,
                        //'Cache-Control' : 'max-age=3600',
                        'Expires:' : content.Expires,
                        });
	res.end(new Buffer(content.data,'base64'));
}

var acquire = function(id,options,callback) {
    methods = {
       create: function(cb) {
            var obj = new mapnik.Map(256, 256);
            try {
                obj.load(id);
            }
            catch (err) {
                callback(err,null);
            }
            cb(obj);
       },
       destroy: function(obj) {
            obj.clear();
            delete obj;
       },
       idleTimeoutMillis: 20000,
    }
    maps.acquire(id, methods, function(obj) {
        callback(null, obj);
    });
}
 
function render(task, callback) {
	
    acquire(task.style.file,{}, function(err, map) {
        if(err) {
            console.log(err);
        }
        else {
            var bbox = mercator.xyz_to_envelope(task.x, task.y, task.z, false)
            map.render(bbox,"png",function(error,data) {
		        //console.log(data)
                console.log("tile rendered");
				if(!error) {
					//TODO clean up tags, different values for different tiles	
					var temp = 	{
						'data' 			:	data.toString('base64'),
						'timestamp'		:	new Date().getTime(),
						'ETag'			: 	require('crypto').createHash('md5').update(data).digest('hex'),
						'Expires' 		:	new Date(new Date().getTime()+task.style.expire).toGMTString(),
					};
					writeResponse(temp,task.res)	
					hdb.putAsync(task.url, JSON.stringify(temp), function(err) {
						if(err) {
							console.log(err);
						}
                        else {
                            console.log("tile saved")
                        }
					});		
				}
				else {
                    console.log(error.message)
					task.res.writeHead(404, {'Content-Type': 'text/plain'});
					task.res.end();
				}
				callback();
			});
        }	
	});
} 

function requestHandler(req, res, style, z, x, y) {
	var url = style + "/" + z + "/" + x + "/" + y;
    console.log(config.styles[style])
    if(config.styles[style] != undefined 
        && z >= config.styles[style].MIN_ZOOM && z <= config.styles[style].MAX_ZOOM
        && x >= 0 && x < Math.pow(2,z)
        && y >= 0 && y < Math.pow(2,z)) {

        hdb.getAsync(url, function(err, value) {
		    if(err) {
			    var renderTask = {
				    'url' : url,
				    'res' : res,
				    'style' : config.styles[style],
				    'z' : parseInt(z),
				    'x' : parseInt(x),
				    'y' : parseInt(y)
				    };
                render(renderTask,function() {});
		    }
		    else {
			    var content = JSON.parse(value);
			    //TODO changeable expire time... 1000*60*60*24 = one day
			    if((new Date().getTime() - content.timestamp) > config.styles[style].expire) {
				    //rerender
				    var renderTask = {
                    'url' : url,
                    'res' : res,
                    'style' : config.styles[style],
                    'z' : parseInt(z),
                    'x' : parseInt(x),
                    'y' : parseInt(y)
                    };
				    //response is send in render function
                    render(renderTask,function() {});
			    } 
			    else {
				    //tile is not expired
				    writeResponse(content, res);
			    }
		    }
	    });

	} else {
        console.log("bad request")
        res.writeHead(404,{})
        res.end()
    }
}

var routes = clutch.route404([
				['GET /(\\w+)/(\\d+)/(\\d+)/(\\d+).png$', requestHandler],
				/*['HEAD /(\\w+)/(\\d+)/(\\d+)/(\\d+).png$', requestHandler],
				['GET /(\\w+)/(\\d+)/(\\d+)/(\\d+).png/dirty$', requestHandler],
				['HEAD /(\\w+)/(\\d+)/(\\d+)/(\\d+).png/dirty$', requestHandler],
				['GET /(\\w+)/(\\d+)/(\\d+)/(\\d+).png/status$', requestHandler],
				['HEAD /(\\w+)/(\\d+)/(\\d+)/(\\d+).png/status$', requestHandler],*/
				]);

http.createServer(routes).listen(config.port, config.host)
console.log('Server started...')
