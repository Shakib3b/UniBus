// ==========================================
// UniBus Driver Dashboard
// ==========================================


// ==========================================
// SUPABASE CONFIGURATION
// ==========================================

const DRIVER_SUPABASE_URL =
    "https://hkgokigrymuslbbtwfpb.supabase.co";

const DRIVER_SUPABASE_KEY =
    "sb_publishable_BqjPT0XpHgK_44BdZ7K7ag_3hthBXBL";


const driverSupabase =
    window.supabase.createClient(
        DRIVER_SUPABASE_URL,
        DRIVER_SUPABASE_KEY
    );


// ==========================================
// GLOBAL VARIABLES
// ==========================================

let driverMap = null;

let routeLine = null;

let stopMarkers = [];

let driverMarker = null;

let driverAccuracyCircle = null;


let currentDriverId = null;

let currentBusId = null;

let currentRouteId = null;

let currentTripId = null;


let gpsWatchId = null;

let gpsRunning = false;

let firstGpsFix = true;

let lastGpsUpdate = null;


// ==========================================
// INITIALIZE MAP
// ==========================================

function initializeMap() {

    driverMap = L.map("map").setView(
        [23.8103, 90.4125],
        12
    );


    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,

            attribution:
                "&copy; OpenStreetMap contributors"
        }
    ).addTo(driverMap);

}


// ==========================================
// LOAD DRIVER DASHBOARD
// ==========================================

async function loadDriverDashboard() {

    try {

        // --------------------------------------
        // Get logged-in user
        // --------------------------------------

        const {
            data: { user },
            error: userError
        } =
            await driverSupabase.auth.getUser();


        if (userError || !user) {

            throw new Error(
                "Driver is not logged in."
            );

        }


        currentDriverId =
            user.id;


        console.log(
            "Logged-in driver:",
            currentDriverId
        );


        // --------------------------------------
        // Get driver record
        // --------------------------------------

        const {
            data: driver,
            error: driverError
        } =
            await driverSupabase
                .from("drivers")
                .select(`
                    id,
                    full_name,
                    phone,
                    license_number,
                    bus_id,
                    is_active
                `)
                .eq("id", user.id)
                .single();


        if (driverError) {
            throw driverError;
        }


        if (!driver) {

            throw new Error(
                "Driver information was not found."
            );

        }


        console.log(
            "Driver record:",
            driver
        );


        // --------------------------------------
        // Driver name
        // --------------------------------------

        const driverName =
            document.getElementById(
                "driverName"
            );


        if (driverName) {

            driverName.textContent =
                driver.full_name ||
                "Driver";

        }


        // --------------------------------------
        // Check driver status
        // --------------------------------------

        if (!driver.is_active) {

            const dashboardMessage =
                document.getElementById(
                    "dashboardMessage"
                );


            if (dashboardMessage) {

                dashboardMessage.textContent =
                    "Your driver account is inactive. Please contact the administrator.";

            }


            return;

        }


        // --------------------------------------
        // No bus assigned
        // --------------------------------------

        if (!driver.bus_id) {

            setText(
                "busNumber",
                "No bus assigned"
            );

            setText(
                "busName",
                "No bus assigned"
            );

            setText(
                "routeName",
                "No route assigned"
            );

            setText(
                "routeDescription",
                "Please contact the administrator."
            );


            const stopList =
                document.getElementById(
                    "stopList"
                );


            if (stopList) {

                stopList.innerHTML =
                    "<li>No stops available.</li>";

            }


            return;

        }


        // --------------------------------------
        // Store bus ID
        // --------------------------------------

        currentBusId =
            driver.bus_id;


        // --------------------------------------
        // Get assigned bus
        // --------------------------------------

        const {
            data: bus,
            error: busError
        } =
            await driverSupabase
                .from("buses")
                .select(`
                    id,
                    bus_number,
                    bus_name
                `)
                .eq(
                    "id",
                    driver.bus_id
                )
                .single();


        if (busError) {
            throw busError;
        }


        if (!bus) {

            throw new Error(
                "Assigned bus was not found."
            );

        }


        setText(
            "busNumber",
            bus.bus_number
        );


        setText(
            "busName",
            bus.bus_name ||
            "University Bus"
        );


        console.log(
            "Assigned bus:",
            bus
        );


        // --------------------------------------
        // Get active route assignment
        // --------------------------------------

        const {
            data: assignment,
            error: assignmentError
        } =
            await driverSupabase
                .from("bus_route_assignments")
                .select(`
                    route_id
                `)
                .eq(
                    "bus_id",
                    driver.bus_id
                )
                .eq(
                    "is_active",
                    true
                )
                .limit(1)
                .maybeSingle();


        if (assignmentError) {
            throw assignmentError;
        }


        // --------------------------------------
        // No route
        // --------------------------------------

        if (!assignment) {

            setText(
                "routeName",
                "No route assigned"
            );


            setText(
                "routeDescription",
                "No active route is assigned to this bus."
            );


            const stopList =
                document.getElementById(
                    "stopList"
                );


            if (stopList) {

                stopList.innerHTML =
                    "<li>No stops available.</li>";

            }


            return;

        }


        // --------------------------------------
        // Store route ID
        // --------------------------------------

        currentRouteId =
            assignment.route_id;


        console.log(
            "Route assignment:",
            assignment
        );


        // --------------------------------------
        // Get route
        // --------------------------------------

        const {
            data: route,
            error: routeError
        } =
            await driverSupabase
                .from("routes")
                .select(`
                    id,
                    route_name,
                    description,
                    route_geometry
                `)
                .eq(
                    "id",
                    assignment.route_id
                )
                .single();


        if (routeError) {
            throw routeError;
        }


        if (!route) {

            throw new Error(
                "Assigned route was not found."
            );

        }


        setText(
            "routeName",
            route.route_name
        );


        setText(
            "routeDescription",
            route.description ||
            "No description available."
        );


        console.log(
            "Assigned route:",
            route
        );


        // --------------------------------------
        // Load route stops
        // --------------------------------------

        const stops =
            await loadRouteStops(
                route.id
            );


        // --------------------------------------
        // Draw route
        // --------------------------------------

        drawRoute(
            route.route_geometry,
            stops
        );


        // --------------------------------------
        // Check active trip
        // --------------------------------------

        await checkActiveTrip();


    } catch (error) {

        console.error(
            "Driver dashboard error:",
            error
        );


        const message =
            document.getElementById(
                "dashboardMessage"
            );


        if (message) {

            message.textContent =
                "Unable to load driver information. Check the browser console.";

        }

    }

}


// ==========================================
// HELPER: SET TEXT
// ==========================================

function setText(
    elementId,
    value
) {

    const element =
        document.getElementById(
            elementId
        );


    if (element) {

        element.textContent =
            value;

    }

}


// ==========================================
// LOAD ROUTE STOPS
// ==========================================

async function loadRouteStops(
    routeId
) {

    const {
        data,
        error
    } =
        await driverSupabase
            .from("route_stops")
            .select(`
                stop_order,
                stops (
                    id,
                    stop_name,
                    latitude,
                    longitude
                )
            `)
            .eq(
                "route_id",
                routeId
            )
            .order(
                "stop_order",
                {
                    ascending: true
                }
            );


    if (error) {
        throw error;
    }


    const stopList =
        document.getElementById(
            "stopList"
        );


    if (stopList) {

        stopList.innerHTML = "";

    }


    if (
        !data ||
        data.length === 0
    ) {

        if (stopList) {

            stopList.innerHTML =
                "<li>No stops assigned to this route.</li>";

        }


        return [];

    }


    data.forEach(
        item => {

            if (!item.stops) {
                return;
            }


            if (!stopList) {
                return;
            }


            const li =
                document.createElement(
                    "li"
                );


            li.innerHTML = `
                <strong>
                    ${item.stop_order}.
                </strong>
                ${item.stops.stop_name}
            `;


            stopList.appendChild(
                li
            );

        }
    );


    console.log(
        "Route stops:",
        data
    );


    return data;

}


// ==========================================
// DRAW ROUTE + STOPS
// ==========================================

function drawRoute(
    routeGeometry,
    stops
) {

    if (!driverMap) {
        return;
    }


    // --------------------------------------
    // Remove previous route
    // --------------------------------------

    if (routeLine) {

        driverMap.removeLayer(
            routeLine
        );

        routeLine = null;

    }


    // --------------------------------------
    // Remove previous stop markers
    // --------------------------------------

    stopMarkers.forEach(
        marker => {

            driverMap.removeLayer(
                marker
            );

        }
    );


    stopMarkers = [];


    // --------------------------------------
    // Extract coordinates
    // --------------------------------------

    let coordinates = [];


    if (
        routeGeometry &&
        routeGeometry.coordinates &&
        Array.isArray(
            routeGeometry.coordinates
        )
    ) {

        coordinates =
            routeGeometry.coordinates;

    }

    else if (
        Array.isArray(
            routeGeometry
        )
    ) {

        coordinates =
            routeGeometry;

    }


    // --------------------------------------
    // Convert:
    // [longitude, latitude]
    //
    // to:
    // [latitude, longitude]
    // --------------------------------------

    const leafletCoordinates =
        coordinates
            .filter(
                point =>
                    Array.isArray(point) &&
                    point.length >= 2
            )
            .map(
                point => [
                    point[1],
                    point[0]
                ]
            );


    // --------------------------------------
    // Draw route
    // --------------------------------------

    if (
        leafletCoordinates.length > 1
    ) {

        routeLine =
            L.polyline(
                leafletCoordinates,
                {
                    weight: 6
                }
            ).addTo(
                driverMap
            );


        driverMap.fitBounds(
            routeLine.getBounds(),
            {
                padding: [
                    30,
                    30
                ]
            }
        );

    }


    // --------------------------------------
    // Draw stops
    // --------------------------------------

    if (
        stops &&
        stops.length > 0
    ) {

        stops.forEach(
            item => {

                if (!item.stops) {
                    return;
                }


                const stop =
                    item.stops;


                const marker =
                    L.marker(
                        [
                            stop.latitude,
                            stop.longitude
                        ]
                    ).addTo(
                        driverMap
                    );


                marker.bindPopup(`
                    <strong>
                        ${item.stop_order}.
                        ${stop.stop_name}
                    </strong>
                    <br>
                    <small>
                        Route Stop
                    </small>
                `);


                stopMarkers.push(
                    marker
                );

            }
        );

    }


    console.log(
        "Route drawn:",
        leafletCoordinates.length,
        "route points"
    );

}


// ==========================================
// UPDATE LIVE BUS / DRIVER MARKER
// ==========================================

function updateDriverMarker(
    latitude,
    longitude,
    accuracy
) {

    if (!driverMap) {
        return;
    }


    // --------------------------------------
    // Get display information
    // --------------------------------------

    const busNumber =
        document.getElementById(
            "busNumber"
        )?.textContent ||
        "Unknown Bus";


    const driverName =
        document.getElementById(
            "driverName"
        )?.textContent ||
        "Driver";


    const tripStatus =
        currentTripId
            ? "🟢 Trip Active"
            : "🟡 Trip Not Started";


    const gpsStatus =
        gpsRunning
            ? "🟢 GPS Active"
            : "🔴 GPS Off";


    lastGpsUpdate =
        new Date();


    // --------------------------------------
    // Create custom bus icon
    // --------------------------------------

    const busIcon =
        L.divIcon({

            className:
                "unibus-driver-marker",

            html: `
                <div style="
                    width:42px;
                    height:42px;
                    background:white;
                    border:3px solid #2563eb;
                    border-radius:50%;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    font-size:25px;
                    box-shadow:
                        0 3px 12px
                        rgba(0,0,0,0.35);
                ">
                    🚌
                </div>
            `,

            iconSize: [
                42,
                42
            ],

            iconAnchor: [
                21,
                21
            ],

            popupAnchor: [
                0,
                -21
            ]

        });


    // --------------------------------------
    // Create marker
    // --------------------------------------

    if (!driverMarker) {

        driverMarker =
            L.marker(
                [
                    latitude,
                    longitude
                ],
                {
                    icon: busIcon,

                    zIndexOffset: 1000
                }
            ).addTo(
                driverMap
            );


        console.log(
            "Live bus marker created."
        );

    }

    else {

        // ----------------------------------
        // Move existing marker
        // ----------------------------------

        driverMarker.setLatLng(
            [
                latitude,
                longitude
            ]
        );

    }


    // --------------------------------------
    // GPS accuracy circle
    // --------------------------------------

    if (!driverAccuracyCircle) {

        driverAccuracyCircle =
            L.circle(
                [
                    latitude,
                    longitude
                ],
                {
                    radius:
                        accuracy || 0,

                    weight: 1,

                    fillOpacity: 0.08
                }
            ).addTo(
                driverMap
            );

    }

    else {

        driverAccuracyCircle.setLatLng(
            [
                latitude,
                longitude
            ]
        );


        driverAccuracyCircle.setRadius(
            accuracy || 0
        );

    }


    // --------------------------------------
    // Last update
    // --------------------------------------

    const updateTime =
        lastGpsUpdate.toLocaleTimeString();


    // --------------------------------------
    // Popup
    // --------------------------------------

    const popupHTML = `

        <div style="
            min-width:210px;
            font-family:Arial,sans-serif;
        ">

            <h3 style="
                margin:0 0 10px 0;
            ">
                🚌 ${busNumber}
            </h3>


            <div>
                <strong>Driver:</strong>
                ${driverName}
            </div>


            <div style="
                margin-top:6px;
            ">
                <strong>Trip:</strong>
                ${tripStatus}
            </div>


            <div style="
                margin-top:6px;
            ">
                <strong>GPS:</strong>
                ${gpsStatus}
            </div>


            <div style="
                margin-top:6px;
            ">
                <strong>Accuracy:</strong>
                ${Math.round(
                    accuracy || 0
                )} m
            </div>


            <div style="
                margin-top:6px;
            ">
                <strong>Latitude:</strong>
                ${latitude.toFixed(6)}
            </div>


            <div style="
                margin-top:6px;
            ">
                <strong>Longitude:</strong>
                ${longitude.toFixed(6)}
            </div>


            <div style="
                margin-top:9px;
                font-size:12px;
                color:#666;
            ">
                Last update:
                ${updateTime}
            </div>

        </div>

    `;


    driverMarker.bindPopup(
        popupHTML
    );


    // --------------------------------------
    // Center map only on first GPS fix
    // --------------------------------------

    if (firstGpsFix) {

        driverMap.setView(
            [
                latitude,
                longitude
            ],
            Math.max(
                driverMap.getZoom(),
                14
            )
        );


        firstGpsFix = false;

    }

}


// ==========================================
// CHECK ACTIVE TRIP
// ==========================================

async function checkActiveTrip() {

    try {

        if (!currentDriverId) {
            return;
        }


        const {
            data: trip,
            error
        } =
            await driverSupabase
                .from("trip_logs")
                .select(`
                    id,
                    bus_id,
                    driver_id,
                    route_id,
                    started_at,
                    ended_at,
                    status
                `)
                .eq(
                    "driver_id",
                    currentDriverId
                )
                .eq(
                    "status",
                    "active"
                )
                .maybeSingle();


        if (error) {
            throw error;
        }


        if (trip) {

            // ----------------------------------
            // Restore complete trip state
            // ----------------------------------

            currentTripId =
                trip.id;


            currentBusId =
                trip.bus_id;


            currentRouteId =
                trip.route_id;


            updateTripUI(
                true
            );


            console.log(
                "Active trip found:",
                trip
            );

        }

        else {

            currentTripId =
                null;


            updateTripUI(
                false
            );


            console.log(
                "No active trip found."
            );

        }

    } catch (error) {

        console.error(
            "Active trip check error:",
            error
        );

    }

}


// ==========================================
// START TRIP
// ==========================================

async function startTrip() {

    try {

        // --------------------------------------
        // Get current driver
        // --------------------------------------

        const {
            data: { user },
            error: userError
        } =
            await driverSupabase.auth.getUser();


        if (
            userError ||
            !user
        ) {

            alert(
                "Driver is not logged in."
            );

            return;

        }


        currentDriverId =
            user.id;


        // --------------------------------------
        // Get driver bus assignment
        // --------------------------------------

        const {
            data: driver,
            error: driverError
        } =
            await driverSupabase
                .from("drivers")
                .select(`
                    id,
                    full_name,
                    bus_id
                `)
                .eq(
                    "id",
                    user.id
                )
                .single();


        if (driverError) {
            throw driverError;
        }


        console.log(
            "Driver before starting trip:",
            driver
        );


        if (
            !driver ||
            !driver.bus_id
        ) {

            alert(
                "No bus is assigned to this driver."
            );

            return;

        }


        currentBusId =
            driver.bus_id;


        // --------------------------------------
        // Get active route
        // --------------------------------------

        const {
            data: assignment,
            error: assignmentError
        } =
            await driverSupabase
                .from("bus_route_assignments")
                .select(`
                    route_id
                `)
                .eq(
                    "bus_id",
                    currentBusId
                )
                .eq(
                    "is_active",
                    true
                )
                .limit(1)
                .maybeSingle();


        if (assignmentError) {
            throw assignmentError;
        }


        if (!assignment) {

            alert(
                "No active route is assigned to this bus."
            );

            return;

        }


        currentRouteId =
            assignment.route_id;


        console.log(
            "Trip information:",
            {
                driverId:
                    currentDriverId,

                busId:
                    currentBusId,

                routeId:
                    currentRouteId
            }
        );


        // --------------------------------------
        // Check existing active trip
        // --------------------------------------

        const {
            data: existingTrip,
            error: existingTripError
        } =
            await driverSupabase
                .from("trip_logs")
                .select("id")
                .eq(
                    "driver_id",
                    currentDriverId
                )
                .eq(
                    "status",
                    "active"
                )
                .maybeSingle();


        if (existingTripError) {
            throw existingTripError;
        }


        if (existingTrip) {

            currentTripId =
                existingTrip.id;


            updateTripUI(
                true
            );


            alert(
                "You already have an active trip."
            );


            return;

        }


        // --------------------------------------
        // Create trip
        // --------------------------------------

        const {
            data: trip,
            error: tripError
        } =
            await driverSupabase
                .from("trip_logs")
                .insert({
                    bus_id:
                        currentBusId,

                    driver_id:
                        currentDriverId,

                    route_id:
                        currentRouteId,

                    status:
                        "active"
                })
                .select()
                .single();


        if (tripError) {
            throw tripError;
        }


        currentTripId =
            trip.id;


        updateTripUI(
            true
        );


        console.log(
            "Trip started successfully:",
            trip
        );


        alert(
            "Trip started successfully!"
        );


    } catch (error) {

        console.error(
            "Start trip error:",
            error
        );


        alert(
            "Unable to start trip: " +
            error.message
        );

    }

}


// ==========================================
// END TRIP
// ==========================================

async function endTrip() {

    try {

        if (!currentTripId) {

            alert(
                "There is no active trip."
            );

            return;

        }


        const confirmEnd =
            confirm(
                "Are you sure you want to end this trip?"
            );


        if (!confirmEnd) {
            return;
        }


        // --------------------------------------
        // Stop GPS first
        // --------------------------------------

        if (gpsRunning) {

            stopGPSTracking();

        }


        // --------------------------------------
        // Update trip
        // --------------------------------------

        const {
            data: trip,
            error
        } =
            await driverSupabase
                .from("trip_logs")
                .update({
                    ended_at:
                        new Date().toISOString(),

                    status:
                        "completed"
                })
                .eq(
                    "id",
                    currentTripId
                )
                .select()
                .single();


        if (error) {
            throw error;
        }


        console.log(
            "Trip ended:",
            trip
        );


        currentTripId =
            null;


        updateTripUI(
            false
        );


        alert(
            "Trip ended successfully!"
        );


    } catch (error) {

        console.error(
            "End trip error:",
            error
        );


        alert(
            "Unable to end trip: " +
            error.message
        );

    }

}


// ==========================================
// UPDATE TRIP UI
// ==========================================

function updateTripUI(
    active
) {

    const tripStatus =
        document.getElementById(
            "tripStatus"
        );


    const startTripButton =
        document.getElementById(
            "startTripBtn"
        );


    const endTripButton =
        document.getElementById(
            "endTripBtn"
        );


    if (active) {

        if (tripStatus) {

            tripStatus.textContent =
                "🟢 Trip Active";

        }


        if (startTripButton) {

            startTripButton.disabled =
                true;

        }


        if (endTripButton) {

            endTripButton.disabled =
                false;

        }

    }

    else {

        if (tripStatus) {

            tripStatus.textContent =
                "🟡 Not Started";

        }


        if (startTripButton) {

            startTripButton.disabled =
                false;

        }


        if (endTripButton) {

            endTripButton.disabled =
                true;

        }

    }

}


// ==========================================
// START GPS TRACKING
// ==========================================

async function startGPSTracking() {

    try {

        // --------------------------------------
        // Browser GPS support
        // --------------------------------------

        if (
            !navigator.geolocation
        ) {

            alert(
                "GPS is not supported by this browser."
            );

            return;

        }


        // --------------------------------------
        // Get logged-in driver
        // --------------------------------------

        const {
            data: { user },
            error: userError
        } =
            await driverSupabase.auth.getUser();


        if (
            userError ||
            !user
        ) {

            alert(
                "Driver is not logged in."
            );

            return;

        }


        currentDriverId =
            user.id;


        // --------------------------------------
        // Get active trip
        // --------------------------------------

        const {
            data: activeTrip,
            error: tripError
        } =
            await driverSupabase
                .from("trip_logs")
                .select(`
                    id,
                    bus_id,
                    driver_id,
                    route_id,
                    status,
                    started_at
                `)
                .eq(
                    "driver_id",
                    user.id
                )
                .eq(
                    "status",
                    "active"
                )
                .maybeSingle();


        if (tripError) {
            throw tripError;
        }


        if (!activeTrip) {

            alert(
                "Please start a trip before starting GPS."
            );

            return;

        }


        // --------------------------------------
        // Restore trip information
        // --------------------------------------

        currentTripId =
            activeTrip.id;


        currentBusId =
            activeTrip.bus_id;


        currentRouteId =
            activeTrip.route_id;


        console.log(
            "Active trip for GPS:",
            activeTrip
        );


        // --------------------------------------
        // Safety checks
        // --------------------------------------

        if (!currentBusId) {

            alert(
                "This trip does not have a bus assigned."
            );

            return;

        }


        if (!currentTripId) {

            alert(
                "Trip ID is missing."
            );

            return;

        }


        // --------------------------------------
        // Prevent duplicate watcher
        // --------------------------------------

        if (gpsRunning) {

            alert(
                "GPS tracking is already running."
            );

            return;

        }


        // --------------------------------------
        // Reset first GPS fix
        // --------------------------------------

        firstGpsFix =
            true;


        // --------------------------------------
        // Start browser GPS watcher
        // --------------------------------------

        gpsWatchId =
            navigator.geolocation.watchPosition(

                handleGPSPosition,

                handleGPSError,

                {
                    enableHighAccuracy:
                        true,

                    maximumAge:
                        5000,

                    timeout:
                        15000
                }

            );


        gpsRunning =
            true;


        // --------------------------------------
        // Update GPS UI
        // --------------------------------------

        setText(
            "gpsStatus",
            "🟢 GPS ON"
        );


        const startGpsButton =
            document.getElementById(
                "startGpsBtn"
            );


        const stopGpsButton =
            document.getElementById(
                "stopGpsBtn"
            );


        if (startGpsButton) {

            startGpsButton.disabled =
                true;

        }


        if (stopGpsButton) {

            stopGpsButton.disabled =
                false;

        }


        console.log(
            "GPS tracking started."
        );


    } catch (error) {

        console.error(
            "GPS start error:",
            error
        );


        alert(
            "Unable to start GPS: " +
            error.message
        );

    }

}


// ==========================================
// HANDLE GPS POSITION
// ==========================================

async function handleGPSPosition(
    position
) {

    try {

        const latitude =
            position.coords.latitude;


        const longitude =
            position.coords.longitude;


        const accuracy =
            position.coords.accuracy;


        const speed =
            position.coords.speed;


        console.log(
            "GPS position:",
            {
                latitude,
                longitude,
                accuracy,
                speed
            }
        );


        // --------------------------------------
        // Update live driver marker
        // --------------------------------------

        updateDriverMarker(
            latitude,
            longitude,
            accuracy
        );


        // --------------------------------------
        // Safety checks
        // --------------------------------------

        if (!currentDriverId) {

            console.warn(
                "Driver ID is missing."
            );

            return;

        }


        if (!currentBusId) {

            console.warn(
                "Bus ID is missing."
            );

            return;

        }


        if (!currentTripId) {

            console.warn(
                "Trip ID is missing."
            );

            return;

        }


        // --------------------------------------
        // Prepare location data
        // --------------------------------------

        const locationData = {

            bus_id:
                currentBusId,

            driver_id:
                currentDriverId,

            trip_id:
                currentTripId,

            latitude:
                latitude,

            longitude:
                longitude,

            speed:
                speed,

            accuracy:
                accuracy,

            updated_at:
                new Date().toISOString()

        };


        console.log(
            "Saving bus location:",
            locationData
        );


        // --------------------------------------
        // Upsert current bus location
        // --------------------------------------

        const {
            data,
            error
        } =
            await driverSupabase
                .from("bus_locations")
                .upsert(
                    locationData,
                    {
                        onConflict:
                            "bus_id"
                    }
                )
                .select()
                .single();


        if (error) {
            throw error;
        }


        console.log(
            "Bus location saved:",
            data
        );


    } catch (error) {

        console.error(
            "GPS location error:",
            error
        );

    }

}


// ==========================================
// STOP GPS TRACKING
// ==========================================

function stopGPSTracking() {

    // --------------------------------------
    // Stop browser GPS watcher
    // --------------------------------------

    if (
        gpsWatchId !== null
    ) {

        navigator.geolocation.clearWatch(
            gpsWatchId
        );


        gpsWatchId =
            null;

    }


    gpsRunning =
        false;


    firstGpsFix =
        true;


    // --------------------------------------
    // Update UI
    // --------------------------------------

    setText(
        "gpsStatus",
        "🔴 GPS OFF"
    );


    const startGpsButton =
        document.getElementById(
            "startGpsBtn"
        );


    const stopGpsButton =
        document.getElementById(
            "stopGpsBtn"
        );


    if (startGpsButton) {

        startGpsButton.disabled =
            false;

    }


    if (stopGpsButton) {

        stopGpsButton.disabled =
            true;

    }


    // --------------------------------------
    // Update marker popup
    // --------------------------------------

    if (driverMarker) {

        const busNumber =
            document.getElementById(
                "busNumber"
            )?.textContent ||
            "Unknown Bus";


        const driverName =
            document.getElementById(
                "driverName"
            )?.textContent ||
            "Driver";


        driverMarker.setPopupContent(`

            <div style="
                min-width:190px;
                font-family:Arial,sans-serif;
            ">

                <h3 style="
                    margin:0 0 8px 0;
                ">
                    🚌 ${busNumber}
                </h3>


                <div>
                    <strong>Driver:</strong>
                    ${driverName}
                </div>


                <div style="
                    margin-top:6px;
                ">
                    <strong>GPS:</strong>
                    🔴 GPS Off
                </div>


                <div style="
                    margin-top:9px;
                    font-size:12px;
                    color:#666;
                ">
                    Tracking stopped
                </div>

            </div>

        `);

    }


    console.log(
        "GPS tracking stopped."
    );

}


// ==========================================
// GPS ERROR HANDLER
// ==========================================

function handleGPSError(
    error
) {

    console.error(
        "GPS error:",
        error
    );


    switch (
        error.code
    ) {

        case error.PERMISSION_DENIED:

            alert(
                "GPS permission was denied. Please allow location access."
            );

            break;


        case error.POSITION_UNAVAILABLE:

            alert(
                "GPS position is currently unavailable."
            );

            break;


        case error.TIMEOUT:

            alert(
                "GPS request timed out."
            );

            break;


        default:

            alert(
                "An unknown GPS error occurred."
            );

    }

}


// ==========================================
// BUTTON EVENTS
// ==========================================

function setupButtonEvents() {

    const startTripButton =
        document.getElementById(
            "startTripBtn"
        );


    const endTripButton =
        document.getElementById(
            "endTripBtn"
        );


    const startGpsButton =
        document.getElementById(
            "startGpsBtn"
        );


    const stopGpsButton =
        document.getElementById(
            "stopGpsBtn"
        );


    // --------------------------------------
    // Start Trip
    // --------------------------------------

    if (startTripButton) {

        startTripButton.addEventListener(
            "click",
            startTrip
        );

    }


    // --------------------------------------
    // End Trip
    // --------------------------------------

    if (endTripButton) {

        endTripButton.addEventListener(
            "click",
            endTrip
        );

    }


    // --------------------------------------
    // Start GPS
    // --------------------------------------

    if (startGpsButton) {

        startGpsButton.addEventListener(
            "click",
            startGPSTracking
        );

    }


    // --------------------------------------
    // Stop GPS
    // --------------------------------------

    if (stopGpsButton) {

        stopGpsButton.addEventListener(
            "click",
            stopGPSTracking
        );

    }

}


// ==========================================
// PAGE INITIALIZATION
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        console.log(
            "UniBus Driver Dashboard starting..."
        );


        // --------------------------------------
        // Initialize map
        // --------------------------------------

        initializeMap();


        // --------------------------------------
        // Setup buttons
        // --------------------------------------

        setupButtonEvents();


        // --------------------------------------
        // Load driver dashboard
        // --------------------------------------

        await loadDriverDashboard();


        // --------------------------------------
        // Fix Leaflet size after page load
        // --------------------------------------

        setTimeout(
            () => {

                if (driverMap) {

                    driverMap.invalidateSize();

                }

            },
            300
        );


        console.log(
            "UniBus Driver Dashboard ready."
        );

    }
);