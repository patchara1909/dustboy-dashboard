// --- 3D Background with Three.js ---
const init3DBackground = () => {
    const container = document.getElementById('particle-canvas');
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050510, 0.002);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 300;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // Particles
    const geometry = new THREE.BufferGeometry();
    const particlesCount = 2000;
    const posArray = new Float32Array(particlesCount * 3);

    for (let i = 0; i < particlesCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 1000;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

    const material = new THREE.PointsMaterial({
        size: 2,
        color: 0x00f3ff,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });

    const particlesMesh = new THREE.Points(geometry, material);
    scene.add(particlesMesh);

    // Animation loop
    let mouseX = 0;
    let mouseY = 0;

    document.addEventListener('mousemove', (event) => {
        mouseX = event.clientX / window.innerWidth - 0.5;
        mouseY = event.clientY / window.innerHeight - 0.5;
    });

    const animate = () => {
        requestAnimationFrame(animate);
        particlesMesh.rotation.y += 0.001;
        particlesMesh.rotation.x += 0.0005;

        // Slight interaction with mouse
        particlesMesh.position.x += (mouseX * 100 - particlesMesh.position.x) * 0.05;
        particlesMesh.position.y += (-mouseY * 100 - particlesMesh.position.y) * 0.05;

        renderer.render(scene, camera);
    };

    animate();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
};

// --- Chart.js Setup ---
let pmChart;
const initChart = () => {
    const ctx = document.getElementById('pmChart').getContext('2d');

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(0, 243, 255, 0.5)');
    gradient.addColorStop(1, 'rgba(0, 243, 255, 0.0)');

    pmChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Avg PM2.5 (µg/m³)',
                    data: [],
                    borderColor: '#00f3ff',
                    backgroundColor: gradient,
                    borderWidth: 2,
                    pointBackgroundColor: '#00f3ff',
                    pointBorderColor: '#fff',
                    pointRadius: 4,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Avg Heat (°C)',
                    data: [],
                    borderColor: '#ff5e00',
                    borderWidth: 2,
                    pointBackgroundColor: '#ff5e00',
                    pointBorderColor: '#fff',
                    pointRadius: 4,
                    fill: false,
                    tension: 0.4
                },
                {
                    label: 'Avg Rain/Humid (%)',
                    data: [],
                    borderColor: '#0084ff',
                    borderWidth: 2,
                    pointBackgroundColor: '#0084ff',
                    pointBorderColor: '#fff',
                    pointRadius: 4,
                    fill: false,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#fff', font: { family: 'Rajdhani' } } }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#a8b2d1' }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#a8b2d1' },
                    beginAtZero: true
                }
            },
            animation: {
                duration: 400
            }
        }
    });
};

// --- MQTT and App Logic ---
const initApp = () => {
    init3DBackground();
    initChart();

    const brokerUrl = 'wss://dustboy-wss-bridge.laris.workers.dev/mqtt';
    const topicRegex = /^DUSTBOY\/.*\/(.*)\/status$/;

    // State 
    const sensors = new Set();
    let msgCount = 0;
    let pm25Sum = 0;
    let pm25Count = 0;
    let tempSum = 0;
    let humidSum = 0;
    let startTime = Date.now();

    // DOM Elements
    const statusEl = document.getElementById('connection-status');
    const totalSensorsEl = document.getElementById('total-sensors');
    const msgRateEl = document.getElementById('msg-rate');
    const avgPm25El = document.getElementById('avg-pm25');
    const avgTempEl = document.getElementById('avg-temp');
    const avgHumidEl = document.getElementById('avg-humid');
    const feedList = document.getElementById('live-feed');

    console.log("Connecting to MQTT...", brokerUrl);
    const client = mqtt.connect(brokerUrl);

    client.on('connect', () => {
        console.log("Connected to MQTT broker");
        statusEl.textContent = 'CONNECTED - LIVE STREAM';
        statusEl.classList.add('connected');
        client.subscribe('DUSTBOY/+/+/+/status', (err) => {
            if (err) console.error("Subscribe error:", err);
            else console.log("Subscribed to DUSTBOY/+/+/+/status");
        });
    });

    client.on('message', (topic, message) => {
        try {
            msgCount++;
            const payload = JSON.parse(message.toString());
            const idMatch = topic.match(DUSTBOY\/(?:[^/]*\/){2}([^/]*)\/status/);
            const sensorId = idMatch ? idMatch[1] : 'Unknown';

            sensors.add(sensorId);
            totalSensorsEl.textContent = sensors.size;

            let pm25 = payload.pm25 || payload.PM25 || 0;
            let pm10 = payload.pm10 || payload.PM10 || 0;
            let temp = payload.temp || payload.temperature || payload.Temp || 0;
            let humid = payload.humid || payload.humidity || payload.Humid || 0;

            // Extract from JSON payload properly if nested
            // Sometimes it's {"value": {"pm25": ...}}
            if (payload.value && (payload.value.pm25 !== undefined || payload.value.temp !== undefined)) {
                pm25 = payload.value.pm25 || pm25;
                pm10 = payload.value.pm10 || pm10;
                temp = payload.value.temp || temp;
                humid = payload.value.humid || humid;
            }

            if (pm25 > 0 || temp > 0) {
                pm25Sum += pm25;
                tempSum += temp;
                humidSum += humid;
                pm25Count++;

                const avgPM = (pm25Sum / pm25Count).toFixed(1);
                const avgT = (tempSum / pm25Count).toFixed(1);
                const avgH = (humidSum / pm25Count).toFixed(1);

                avgPm25El.textContent = avgPM;
                avgTempEl.textContent = avgT;
                avgHumidEl.textContent = avgH;

                // Update chart every 20 valid hits (downsampling rate to prevent overload)
                if (pm25Count % 20 === 0 || pm25Count === 1) {
                    const timeLabel = new Date().toLocaleTimeString();
                    pmChart.data.labels.push(timeLabel);
                    pmChart.data.datasets[0].data.push(avgPM);
                    pmChart.data.datasets[1].data.push(avgT);
                    pmChart.data.datasets[2].data.push(avgH);

                    if (pmChart.data.labels.length > 20) {
                        pmChart.data.labels.shift();
                        pmChart.data.datasets[0].data.shift();
                        pmChart.data.datasets[1].data.shift();
                        pmChart.data.datasets[2].data.shift();
                    }
                    pmChart.update();
                }
            }

            // Calculate rate
            const elapsedMins = (Date.now() - startTime) / 60000;
            if (elapsedMins > 0) {
                msgRateEl.textContent = Math.round(msgCount / elapsedMins);
            }

            // Update Feed UI
            updateFeed(sensorId, pm25, pm10, temp, humid);

        } catch (e) {
            console.error("Parse Error:", e);
        }
    });

    const updateFeed = (id, pm25, pm10, temp, humid) => {
        const li = document.createElement('li');
        li.className = 'feed-item';

        // Color coding logic
        let pmClass = 'pm-low';
        if (pm25 > 50) pmClass = 'pm-mid';
        if (pm25 > 100) pmClass = 'pm-high';

        li.innerHTML = `
            <div class="feed-id">ID: ${id.substring(0, 8)}... | ${new Date().toLocaleTimeString()}</div>
            <div class="feed-data" style="display:grid; grid-template-columns: 1fr 1fr; gap:5px;">
                <span class="${pmClass}">PM2.5: ${pm25}</span>
                <span class="${pmClass}">PM10: ${pm10}</span>
                <span style="color:#ff5e00">Heat: ${temp}°C</span>
                <span style="color:#0084ff">Rain/Humid: ${humid}%</span>
            </div>
        `;

        feedList.prepend(li);

        // Keep only top 50 items
        if (feedList.childElementCount > 50) {
            feedList.removeChild(feedList.lastChild);
        }
    };
};

window.onload = initApp;
