$(function() {
    var wsUri = 'ws://busdrone.com:28737/';

    var templates = {
        table: '<table><tbody>{body}</tbody></table>',
        row:'<tr><th>{key}</th><td>{value}</td></tr>',
        link:'<tr><th>{key}</th><td><a href="{href}" target="_blank">{title}</a></td></tr>',
        busMarker: '<div class="bus-route" style="border-bottom-color: {color};" title="{title}">{route}</div>',
        busMarkerTitle: '{destination}\nCurrent direction: {direction}'
    };

    var osm = L.tileLayer('http://{s}.tile2.opencyclemap.org/transport/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors,' +
            'tiles from <a href="http://www.opencyclemap.org/">OpenCycleMap</a>'
    });

    var map = L.map('map', {
        center: [47.6210, -122.3328],
        zoom: 12,
        layers: [osm]
    });

    L.control.locate({
        locateOptions: {
            maxZoom: 16
        },
        follow: true
    }).addTo(map);

    L.control.scale().addTo(map);

    var hash = new L.Hash(map);

    // the markers
    var markers = {};

    // the vehicles
    var vehicles = {};

    // the routeLine
    var routeLine;

    function debug(val) {
      console.log(val);
    }

    function wsConnect() {
        debug('Connecting to ' + wsUri);
        websocket = new WebSocket(wsUri);
        websocket.onopen = onWsOpen;
        websocket.onmessage = onWsMessage;
        websocket.onerror = onWsError;
        websocket.onclose = onWsClose;
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
            var marker = markers[vehicle.uid];
            if (getAge(vehicle) > 5) {
                removeVehicle(vehicle.uid);
                return;
            }
            if (marker === undefined) {
                marker = addVehicle(data.vehicle);
            }
            // update the direction
            $(marker._icon).attr('title', L.Util.template(templates.busMarkerTitle, {
                destination: vehicle.destination,
                direction: getDir(vehicle.heading)
            }));
            // $('.bus-route').tooltip();

            // set to bus route 
            var line = L.polyline([marker.getLatLng(), [vehicle.lat, vehicle.lon]]);
            marker.stop();
            marker.setLine(line.getLatLngs());
            marker.start();
        } else if (data.type == 'init') {
            // data.vehicles.forEach(addVehicle);
            $.each(data.vehicles, function(key, vehicle) {
                var marker = addVehicle(vehicle);
                vehicles[vehicle.uid] = {vehicle: vehicle, marker: marker};
            });
        } else if (data.type == 'remove_vehicle') {
            removeVehicle(data.vehicle_uid);
        } else if (data.type == 'trip_polyline') {
            if (routeLine !== undefined) {
                map.removeLayer(routeLine);
            }
            routeLine = L.Polyline.fromEncoded(data.polyline, {
                color: 'red',
                weight: 3,
                opacity: 0.9
            }).addTo(map);
        } else {
            debug("undefined");
            debug(data);
        }
    }

    function onWsError(evt) {
        debug("error");
        debug(evt.data);
    }

    function addVehicle(vehicle) {
        var body = '';
        jQuery.each(vehicle, function(key, value){
            body += L.Util.template(templates.row, {key: key, value: value});
        });
        trip_status_url = "http://api.pugetsound.onebusaway.org/api/where/trip-for-vehicle/" + vehicle.vehicleId + ".json?key=TEST&callback=?";
        body += L.Util.template(templates.link, {key: "OneBusAway API", title: "Trip Status", href: trip_status_url});

        var icon = new L.divIcon({
            iconSize: 30,
            className: "bus",
            html: L.Util.template(templates.busMarker, {
                route: vehicle.route,
                color: vehicle.color.substring(0,7),
                title: L.Util.template(templates.busMarkerTitle, {
                    destination: vehicle.destination,
                    direction: getDir(vehicle.heading)
                })
            })
        });

        var popupContent = L.Util.template(templates.table, {body: body});
        var line = L.polyline([[vehicle.lat, vehicle.lon], [vehicle.lat, vehicle.lon]]);
        marker = L.animatedMarker(line.getLatLngs(), {
                interval: 2000, // milliseconds
                icon: icon,
                clickable: true
            })
            //.bindPopup(popupContent)
            .on('click', function(e) {
                websocket.send(JSON.stringify({type: "trip_polyline", trip_uid: vehicle.dataProvider + "/" + vehicle.tripId}));
                // jQuery.getJSON(trip_status_url, null, function(response) {
                //   window.alert("Bus is " + Math.round(response.data.entry.status.scheduleDeviation / 60) + " minutes late")
                // });
            })
            .addTo(map);
        markers[vehicle.uid] = marker;

        // bind popups for all vehicles
        // $('.bus-route').tooltip();

        return marker;
    }

    function removeVehicle(vehicle_uid) {
        map.removeLayer(markers[vehicle_uid]);
        delete markers[vehicle_uid];
    }

    // returns the age in minutes
    function getAge(vehicle) {
        var ageMins = (new Date() - vehicle.timestamp) / 1000 / 60;
        return ageMins;
    }

    // returns the direction for a heading in degrees
    function getDir(heading) {
        var dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW', 'N'];
        return dirs[Math.round(heading/22.5)];
    }

    // zoom start event
    // remove markers (animated and non-animated)
    map.on('zoomstart', function(e) {
        for (var uid in vehicles) {
            removeVehicle(vehicles[uid].vehicle.uid);
        }
    });

    // zoom end event
    // add markers
    map.on('zoomend', function(e) {
        for (var uid in vehicles) {
            var marker = addVehicle(vehicles[uid].vehicle);
            marker.addTo(map);
            vehicles[uid].marker = marker;
        }
    });

    // start by connecting to the web socket
    wsConnect();
});

