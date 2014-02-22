$(function() {
    var wsUri = 'ws://busdrone.com:28737/';

    var templates = {
        table: '<table><tbody>{body}</tbody></table>',
        row:'<tr><th>{key}</th><td>{value}</td></tr>'
    };

    var map = L.map('map', {
        center: [47.6210, -122.3328],
        zoom: 13
    });

    var mapboxTiles = L.tileLayer('https://{s}.tiles.mapbox.com/v3/domoritz.h6ibh733/{z}/{x}/{y}.png', {
        attribution: '<a href="http://www.mapbox.com/about/maps/" target="_blank">Terms &amp; Feedback</a>'
    }).addTo(map);

    L.control.locate().addTo(map);

    var markers = {};

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
        var vehicle = data.vehicle;
        markers[vehicle.vehicleId].setLatLng([vehicle.lat, vehicle.lon])
      } else if (data.type == 'init') {
        data.vehicles.forEach(function(vehicle) {
            var body = '';
            jQuery.each(vehicle, function(key, value){
                body += L.Util.template(templates.row, {key: key, value: value});
            });
            var popupContent = L.Util.template(templates.table, {body: body});
            markers[vehicle.vehicleId] = L.marker([vehicle.lat, vehicle.lon])
                //.bindPopup(popupContent)
                .on('click', function(e) {
                    websocket.send(JSON.stringify({type: "trip_polyline", trip_uid: vehicle.dataProvider + "/" + vehicle.tripId}))
                })
                .addTo(map);
        });
      } else if (data.type == 'remove_vehicle') {
        debug('remove');
      } else if (data.type == 'trip_polyline') {
        debug(data);
        L.Polyline.fromEncoded(data.polyline).addTo(map);
      } else {
        debug(data);
      }
    }

    wsConnect();

    var hash = new L.Hash(map);
});

