var TC = require('../node-tokyocabinet/build/default/tokyocabinet')
var path = require('path')
var fs = require('fs')
var mkdirp = require('mkdirp').mkdirp


var HDB = TC.HDB
var hdb = new HDB

if(!hdb.open('../tile.tch', HDB.OWRITER | HDB.OCREAT)) {
    sys.error(hdb.errmsg())
}

hdb.iterinit()

var iter = function(key,cb) {
    if(key == null) {
        cb()
        return
    }
    var tmp = key.split('/')
    tmp.pop()
    console.log(tmp)
    var dirstr = __dirname + '/' + tmp.join('/')
    path.exists(dirstr,function(exists) {
        if(!exists) {
            mkdirp(dirstr, 0755, function(err) {
                if(err) {
                    console.error(err)
                }
                //create file
                fs.writeFile(__dirname + '/' + key + '.png', 'bla', function(err) {
                    if(err) {
                        console.log(err)
                    }

                }) 
                iter(hdb.iternext(), cb)
            })
        } else {
            fs.writeFile(__dirname + '/' + key + '.png', 'bla', function(err) {
            })
            iter(hdb.iternext(), cb)
            //dir exists
        }
    })
}

iter(hdb.iternext(),function() {
    hdb.close()
})

