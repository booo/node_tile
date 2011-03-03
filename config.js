exports.styles = {
    osm     :   {
                file        :   '../mapnik/performance_upgrade.xml',
                "MAX_ZOOM"  :   18,
                "MIN_ZOOM"  :   0,
                expire      :   60*60*24    //seconds
                }
}

exports.port = 8000
exports.host = 'localhost'

exports.cacheFile = 'tile.tch'
