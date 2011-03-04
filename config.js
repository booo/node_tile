exports.styles = {
    osm     :   {
                file        :   '../mapnik/performance_upgrade.xml',
                "MAX_ZOOM"  :   18,
                "MIN_ZOOM"  :   0,
                expire      :   60*60*24,    //seconds
                idleTimeoutMillis   :   1000*60*60 //milliseconds
                }
}

exports.port = 8000
exports.host = 'localhost'

exports.cacheFile = 'tile.tch'
