var mapnik = require('mapnik');
var TC = require('./node-tokyocabinet/build/default/tokyocabinet');

var path = require('path');
var clutch = require('clutch');
//var hasher = require('crypto').createHash('md5');

var async = require('async');

var queue = async.queue(render,2);

var stylesheet = path.join(__dirname,"style.xml");

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
 
  
function render(task, callback) {
	
	var map = new mapnik.Map(256,256);
    map.load(task.stylesheet+".xml");
    map.zoom_all();
	
	map.render(map.extent(),function(data) {
			
				if(data) {
					//TODO clean up tags, different values for different tiles	
						
					
					var temp = 	{
						'data' 			:	data.toString('base64'),
						'timestamp'		:	new Date().getTime(),
						'ETag'			: 	require('crypto').createHash('md5').update(data).digest('hex'),
						'Expires' 		:	new Date(new Date().getTime()+3600000).toGMTString(),
					};
					
					writeResponse(temp,task.res)	
					//console.log(temp.timestamp);
					//console.log(temp.ETag);
					//TODO do async
					hdb.put(task.url, JSON.stringify(temp));
					//hdb.put(url, data.toString('base64'));

					hdb.putAsync(task.url, JSON.stringify(temp), function(err) {
						if(err) {
							console.log(err);
						}	
					});		
				}
				else {
					task.res.writeHead(404, {'Content-Type': 'text/plain'});
					task.res.end();
				}
				callback();
			});
	
	
	
} 

function render2(worker) {
	//console.log(worker);
	worker.finish();
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
				'z' : z,
				'x' : x,
				'y' : y
				};
				
			queue.push(renderTask, function() {});
			//var data = map.render_to_string();
            
		}
		else {
			//console.log(value);
			res.writeHead(200, {'Content-Type': 'image/png'});
			res.end(new Buffer( JSON.parse(value).data,'base64')); }

	});

	
}


var myRoutes = clutch.route404([
				['GET /(\\w+)/(\\d+)/(\\d+)/(\\d+).png$', requestHandler],
				]);




var http = require('http');
http.createServer(myRoutes).listen(8000, 'localhost');


