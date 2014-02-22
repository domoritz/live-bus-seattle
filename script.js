$(function() {
    var osm = L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
    });

    var map = L.map('map', {
        center: [47.6210, -122.3328],
        zoom: 13,
        layers: [osm]
    });

    $.getJSON('http://api.onebusaway.org/api/where/vehicles-for-agency/1.json?key=TEST&callback=?', function(data) {
        console.log(data);
    });

    var hash = new L.Hash(map);
});
