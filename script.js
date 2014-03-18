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

    // the routeLine
    var routeLine;

    function debug(val) {
      console.log(val);
    }

    // zoom start event
    // remove markers (animated and non-animated)
    map.on('zoomstart', function(e) {
        seattleTransit.removeMarkers();
    });

    // zoom end event
    // add markers
    map.on('zoomend', function(e) {
        seattleTransit.addMarkers();
    });

    // add markers when window  is in focus
    $(window).on('focus', function() {
        debug("focus");
        //seattleTransit.addMarkers();
    });

    // remove markers when windo iis out of focus
    $(window).on('blur', function(){
        debug("blur");
        //seattleTransit.removeMarkers();
    });

    var SeattleTransit = function() {
        var vehicles = {};

        function TripDetails(id) {
            return $.ajax({
                            type: 'GET',
                            dataType: 'jsonp',
                            url: "http://api.onebusaway.org/api/where/trip-details/" + id + ".json?key=TEST"
                        });
        }
        
        function Trip(id) {
            return $.ajax({
                                type: 'get',
                                dataType: 'jsonp',
                                url: "http://api.onebusaway.org/api/where/trip/" + id + ".json?key=TEST&includeReferences=false"
                            });
        }

        function TripPath(id) {
            return $.ajax({
                                type: 'get',
                                dataType: 'jsonp',
                                url: "http://api.pugetsound.onebusaway.org/api/where/shape/"+ id + ".json?key=TEST&includeReferences=false"
                            });
        }

        function BusRoute(id) {
            return $.getJSON("bus_routes/"+id + ".geojson");
        }

        function BusStatus(id) {
            return $.ajax({
                            type: 'GET',
                            dataType: 'jsonp',
                            url: "http://api.onebusaway.org/api/where/trip-for-vehicle/" + id + ".json?key=TEST&includeReferences=false"
                        });
        }

        function TripSchedule(id) {
            return $.ajax({
                            type: 'GET',
                            dataType: 'jsonp',
                            url: "http://api.onebusaway.org/api/where/trip-details/" + id + ".json?key=TEST&includeReferences=false"
                        });
        }

        function Marker(vehicle, path, pathDistance, pathTime) {
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
            return L.animatedMarker(path.getLatLngs(), {
                    distance: pathDistance,
                    interval: pathTime, // milliseconds
                    icon: icon,
                    clickable: true
                })
                .on('click', function(e) {
                    websocket.send(JSON.stringify({type: "trip_polyline", trip_uid: vehicle.dataProvider + "/" + vehicle.tripId}));
                });
        }

        function PopupContent(vehicle) {
                var _body = '';
                jQuery.each(vehicle, function(key, value){
                    _body += L.Util.template(templates.row, {key: key, value: value});
                });
                trip_status_url = "http://api.pugetsound.onebusaway.org/api/where/trip-for-vehicle/" + vehicle.vehicleId + ".json?key=TEST&callback=?";
                _body += L.Util.template(templates.link, {key: "OneBusAway API", title: "Trip Status", href: trip_status_url});
                return L.Util.template(templates.table, {body: _body});
        }

        return {
            init: function(vehicle) {
                    var latlng = L.latLng(vehicle.lat, vehicle.lon);
                    var line = L.polyline([latlng,latlng]);
                    vehicle.marker = Marker(vehicle, line, 1, 1).addTo(map);
                    vehicle.marker.bindPopup(PopupContent(vehicle));
                    vehicles[vehicle.uid] = {bus: vehicle};
            },
            
            removeVehicle: function(vehicle) {
                 delete vehicles[vehicle.uid];
            },

            animate: function(vehicle) {
                    var _vehicle = vehicle;
                    $.ajax({
                        type: 'get',
                        dataType: 'jsonp',
                        url: "http://api.onebusaway.org/api/where/trip/" + vehicle.tripId + ".json?key=TEST&includeReferences=false",
                        success: function(resp) {
                            _vehicle.direction = resp.data.entry.directionId;
                            _vehicle.shapeId = resp.data.entry.shapeId;
                            $.ajax({
                                type: 'get',
                                dataType: 'jsonp',
                                url: "http://api.pugetsound.onebusaway.org/api/where/shape/"+ _vehicle.shapeId + ".json?key=TEST&includeReferences=false",
                                success: function(resp) {
                                    _vehicle.path = L.Polyline.fromEncoded(resp.data.entry.points);

                                    // set path direction
                                    if (_vehicle.direction === 1)  { // inbound
                                        var points = _vehicle.path.getLatLngs();
                                        points.reverse();
                                        _vehicle.path = L.polyline(points);
                                    }
                                    $.ajax({
                                        type: 'GET',
                                        dataType: 'jsonp',
                                        url: "http://api.onebusaway.org/api/where/trip-details/" + vehicle.tripId + ".json?key=TEST&includeReferences=false",
                                        success: function(resp) {
                                            _vehicle.schedule = resp.data.entry.schedule;
                                            $.ajax({
                                                type: 'GET',
                                                dataType: 'jsonp',
                                                url: "http://api.onebusaway.org/api/where/trip-for-vehicle/" + vehicle.vehicleId + ".json?key=TEST&includeReferences=false",
                                                success: function(resp) {
                                                    _vehicle.status = resp.data.entry.status;

                                                        // calculate average rate
                                                        _vehicle.pathTime = 1000 * (_vehicle.schedule.stopTimes[_vehicle.schedule.stopTimes.length-1].arrivalTime - _vehicle.schedule.stopTimes[0].departureTime);
                                                        _vehicle.pathDistance = _vehicle.status.totalDistanceAlongTrip;
                                                        _vehicle.activePath = _vehicle.path;
                                                        _vehicle.remainingDistance = _vehicle.status.totalDistanceAlongTrip - _vehicle.status.distanceAlongTrip;
                                                        _vehicle.remainingTime = (_vehicle.remainingDistance / _vehicle.status.totalDistanceAlongTrip) * _vehicle.pathTime;
                                                        // debug("time = " + _vehicle.pathTime + ", distance=" + _vehicle.pathDistance + ", remaining=" + _vehicle.remainingDistance);
                                                        var start = _vehicle.activePath._latlngs[0];
                                                        $.each(_vehicle.activePath._latlngs, function(index, point){
                                                                            if ( start.distanceTo(point) > _vehicle.status.distanceAlongTrip ) {
                                                                                    _vehicle.activePath.spliceLatLngs(0, index);
                                                                                    return false;
                                                                            }
                                                        });

                                                        // remove old marker
                                                        map.removeLayer(vehicles[_vehicle.uid].bus.marker);

                                                        // debug(_vehicle);
                                                        _vehicle.marker = Marker(_vehicle, _vehicle.activePath, _vehicle.remainingDistance, _vehicle.remainingTime);
                                                        // add marker
                                                        _vehicle.marker.addTo(map);
                                                        delete vehicles[_vehicle.uid];
                                                        vehicles[_vehicle.uid] = {bus: _vehicle};
                                                }
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });
            },

            updateVehicle: function(vehicle) {
                    // debug("update vehicle");
                    // adjust animated marker
                    // to do
            },
            
            removeMarkers: function() {
                $.each(vehicles, function(key, obj){
                        map.removeLayer(obj.bus.marker);
                });
            },

            addMarkers: function() {
                $.each(vehicles, function(key, obj){
                    var _marker = obj.bus.marker;
                    obj.bus.marker = Marker(obj.bus, L.polyline(_marker._latlngs), _marker.options.distance, _marker.options.interval).addTo(map);
                });
            },
            vehicles: vehicles
        };
    };

    function wsConnect() {
        debug('Connecting to ' + wsUri);
        websocket = new WebSocket(wsUri);
        websocket.onopen = onWsOpen;
        websocket.onmessage = onWsMessage;
        websocket.onerror = onWsError;
        websocket.onclose = onWsClose;

        seattleTransit = new SeattleTransit();
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
            debug("update vehicle");
            if (getAge(vehicle) > 5) {
                seattleTransit.removeVehicle(vehicle.uid);
                return;
            }
            if (seattleTransit.vehicles[vehicle.uid] === undefined) {
                seattleTransit.init(vehicle);
            } else if (seattleTransit.vehicles[vehicle.uid].bus.activePath === undefined) {
                seattleTransit.animate(vehicle);
            } else {
                seattleTransit.updateVehicle(vehicle);
            }
            // update the direction
            // $(marker._icon).attr('title', L.Util.template(templates.busMarkerTitle, {
            //     destination: vehicle.destination,
            //     direction: getDir(vehicle.heading)
            // }));
        } else if (data.type == 'init') {
            $.each(data.vehicles, function(key, vehicle) {
                        seattleTransit.init(vehicle);
                });
            // debug(seattleTransit);
        } else if (data.type == 'remove_vehicle') {
            seattleTransit.removeVehicle(data.vehicle_uid);
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

    // start by connecting to the web socket
    wsConnect();

});

