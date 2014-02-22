$(function() {
    var osm = L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
    });

    var wsUri = 'ws://busdrone.com:28737/';

    var map = L.map('map', {
        center: [47.6210, -122.3328],
        zoom: 13,
        layers: [osm]
    });

    function debug(val) {
      console.log(val);
    }

    function wsConnect() {
      debug('Connecting to ' + wsUri);
      websocket = new WebSocket(wsUri);
      websocket.onopen = function(evt) { onWsOpen(evt) };
      websocket.onmessage = function(evt) { onWsMessage(evt) };
      websocket.onerror = function(evt) { onWsError(evt) };
      websocket.onclose = function(evt) { onWsClose(evt) };
    }

    function onWsOpen(evt) {
      debug('Connected');
    }

    function onWsClose(evt) {
      debug('Disconnected');
      window.setTimeout(wsConnect, Math.random() * 1000 * 25 + 5);
    }

    function onWsMessage(evt) {
      var data = JSON.parse(evt.data);
      if (data.type == 'update_vehicle') {
      } else if (data.type == 'init') {
        data.vehicles.forEach(function(vehicle) {
            L.marker([vehicle.lat, vehicle.lon]).addTo(map);
        });
      } else if (data.type == 'remove_vehicle') {
        debug('remove');
      } else {
        debug('unknown', data)
      }
    }

    wsConnect();

    var hash = new L.Hash(map);
});
