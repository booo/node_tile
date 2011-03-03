var config = require('./config');	//include config file
var mapnik = require('mapnik');
var TC = require('./node-tokyocabinet/build/default/tokyocabinet');
var path = require('path');
var clutch = require('clutch');
var mercator = require('mapnik/sphericalmercator')
var mappool = require('mapnik/pool')

//var hasher = require('crypto').createHash('md5');

//var async = require('async');

//var queue = async.queue(render,2);

var stylesheet = path.join(__dirname,"/mapnik/osm_new.xml");
/*var stylesheet = path.join(__dirname, "node-mapnik/examples/stylesheet.xml")*/

var maps = mappool.create(2);

console.log("Tokyo Cabinet version " + TC.VERSION);

var HDB = TC.HDB;

var hdb = new HDB;

if (!hdb.open('tile.tch', HDB.OWRITER | HDB.OCREAT)) {
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
	
    acquire(stylesheet,{}, function(err, map) {
        if(err) {
            console.log(err);
        }
        else {
            console.log("map acquired\n")
       
    //map.zoom_to_box(tile2long(task.x,task.z),tile2lat(task.y,task.z),tile2long(task.x+1,task.z),tile2lat(task.y+1,task.z));
    //map.zoom_all()
    //var bbox = [tile2lat(task.y,task.z),tile2long(task.x,task.z),tile2lat(task.y-1,task.z),tile2long(task.x-1,task.z)];
	//var bbox = [13.0882097323,52.3418234221,13.7606105539,52.6697240587]
    //map.zoom_all()//map.zoom_to_box(extent);
    //map.zoom_all();
    
    
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
						'Expires' 		:	new Date(new Date().getTime()+3600000).toGMTString(),
					};
					
					writeResponse(temp,task.res)	
					console.log(temp.data)
                    //console.log(temp.timestamp);
					//console.log(temp.ETag);
					//TODO do async
					//hdb.put(task.url, JSON.stringify(temp));
					//hdb.put(url, data.toString('base64'));

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
	//console.log(style, z, x, y);
	var url = style + "/" + z + "/" + x + "/" + y;
		
	hdb.getAsync(url, function(err, value) {
		//console.log(value);	
		if(err) {
			var renderTask = {
				'url' : url,
				'res' : res,
				'stylesheet' : style,
				'z' : parseInt(z),
				'x' : parseInt(x),
				'y' : parseInt(y)
				};
				
			//queue.push(renderTask, function() {});
			//var data = map.render_to_string();
            render(renderTask,function() {});
		}
		else {
			//console.log(value);
			var content = JSON.parse(value);
			//TODO changeable expire time... 1000*60*60*24 = one day
			if((new Date().getTime() - content.timestamp) > 1000*60*60) {
				//rerender
				var renderTask = {
                'url' : url,
                'res' : res,
                'stylesheet' : style,
                'z' : parseInt(z),
                'x' : parseInt(x),
                'y' : parseInt(y)
                };
				//response is send in render function
                /*queue.push(renderTask, function() {});*/
                render(renderTask,function() {});
			} 
			else {
				//tile is not expired
				writeResponse(content, res);
			}
		}
	});

	
}


var myRoutes = clutch.route404([
				['GET /(\\w+)/(\\d+)/(\\d+)/(\\d+).png$', requestHandler],
				/*['HEAD /(\\w+)/(\\d+)/(\\d+)/(\\d+).png$', requestHandler],
				['GET /(\\w+)/(\\d+)/(\\d+)/(\\d+).png/dirty$', requestHandler],
				['HEAD /(\\w+)/(\\d+)/(\\d+)/(\\d+).png/dirty$', requestHandler],
				['GET /(\\w+)/(\\d+)/(\\d+)/(\\d+).png/status$', requestHandler],
				['HEAD /(\\w+)/(\\d+)/(\\d+)/(\\d+).png/status$', requestHandler],*/
				]);




var http = require('http');
http.createServer(myRoutes).listen(8000, 'localhost');


