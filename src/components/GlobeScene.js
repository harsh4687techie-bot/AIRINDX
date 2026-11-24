/**
 * Local Three.js 3D Earth Telemetry Scene
 * Preserves the Stitch Three.js globe prototype using bundled `three`
 * with WebGL detection fallback, reduced-motion support, interactive mode
 * switching, and clean disposal.
 */

import * as THREE from 'three';

function latLongToVector3(lat, lon, radius) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

const DEFAULT_GLOBE_STATIONS = [
  { name: 'Mumbai BKC-04', lat: 19.0657, lon: 72.8687, aqi: 168, color: 0xf2994a },
  { name: 'Pune Shivajinagar', lat: 18.5308, lon: 73.8475, aqi: 96, color: 0xf2c94c },
  { name: 'New Delhi Anand Vihar', lat: 28.6469, lon: 77.316, aqi: 337, color: 0x9b51e0 },
  { name: 'Tokyo Shinjuku', lat: 35.6895, lon: 139.6917, aqi: 42, color: 0xb9ed73 },
  { name: 'London Westminster', lat: 51.5007, lon: -0.1246, aqi: 56, color: 0xf2c94c },
  { name: 'Singapore Marina Bay', lat: 1.2838, lon: 103.8591, aqi: 48, color: 0xb9ed73 },
];

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

export function mountGlobeScene(
  container,
  stations = DEFAULT_GLOBE_STATIONS,
  { focusLat = 19.0657, focusLon = 72.8687, initialMode = 'globe' } = {}
) {
  if (!container) return () => {};

  if (!supportsWebGL()) {
    container.replaceChildren();
    const fallback = document.createElement('div');
    fallback.className =
      'w-full h-full flex flex-col items-center justify-center text-center p-6 text-white/80';

    const img = document.createElement('img');
    img.src = '/assets/earth-globe.webp';
    img.alt = 'AIRINDX 2D Earth Observatory fallback illustration';
    img.className = 'w-44 h-44 object-contain rounded-full opacity-90 mb-3';

    const caption = document.createElement('p');
    caption.className = 'font-label-micro text-xs text-aqi-good';
    caption.textContent = '2D Earth Fallback Active (WebGL unavailable)';

    fallback.appendChild(img);
    fallback.appendChild(caption);
    container.appendChild(fallback);
    return () => {};
  }

  const prefersReducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const width = container.clientWidth || 420;
  const height = container.clientHeight || 360;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.z = 2.8;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xb9ed73, 1.2);
  dirLight.position.set(5, 3, 5);
  scene.add(dirLight);

  const blueLight = new THREE.DirectionalLight(0x237a5b, 0.9);
  blueLight.position.set(-5, -2, -3);
  scene.add(blueLight);

  const earthGroup = new THREE.Group();
  scene.add(earthGroup);

  const globeGeo = new THREE.SphereGeometry(1, 48, 48);
  const globeMat = new THREE.MeshPhongMaterial({
    color: 0x10251f,
    emissive: 0x071511,
    specular: 0x237a5b,
    shininess: 25,
  });
  earthGroup.add(new THREE.Mesh(globeGeo, globeMat));

  const wireGeo = new THREE.SphereGeometry(1.006, 32, 16);
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x237a5b,
    wireframe: true,
    transparent: true,
    opacity: 0.18,
  });
  earthGroup.add(new THREE.Mesh(wireGeo, wireMat));

  const atmosGeo = new THREE.SphereGeometry(1.15, 36, 36);
  const atmosMat = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      void main() {
        float intensity = pow(0.6 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
        gl_FragColor = vec4(0.725, 0.929, 0.451, 1.0) * intensity * 0.4;
      }
    `,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true,
  });
  const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
  earthGroup.add(atmosMesh);

  const markerGroup = new THREE.Group();
  earthGroup.add(markerGroup);

  const rings = [];
  stations.forEach((st) => {
    const pos = latLongToVector3(st.lat, st.lon, 1.01);
    const pinMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.024, 12, 12),
      new THREE.MeshBasicMaterial({ color: st.color })
    );
    pinMesh.position.copy(pos);
    markerGroup.add(pinMesh);

    const ringMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.028, 0.05, 20),
      new THREE.MeshBasicMaterial({
        color: st.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      })
    );
    ringMesh.position.copy(pos);
    ringMesh.lookAt(pos.clone().multiplyScalar(2));
    markerGroup.add(ringMesh);
    rings.push({ mesh: ringMesh });

    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      pos,
      pos.clone().multiplyScalar(1.08),
    ]);
    const lineMat = new THREE.LineBasicMaterial({
      color: st.color,
      transparent: true,
      opacity: 0.75,
    });
    markerGroup.add(new THREE.Line(lineGeo, lineMat));
  });

  const orbitCurve = new THREE.EllipseCurve(0, 0, 1.35, 1.35, 0, 2 * Math.PI, false, 0);
  const orbitPoints = orbitCurve.getPoints(80);
  const orbitGeo = new THREE.BufferGeometry().setFromPoints(
    orbitPoints.map((p) => new THREE.Vector3(p.x, 0, p.y))
  );
  const orbitMat = new THREE.LineDashedMaterial({
    color: 0xb9ed73,
    dashSize: 0.05,
    gapSize: 0.03,
    transparent: true,
    opacity: 0.5,
  });
  const orbitLine = new THREE.Line(orbitGeo, orbitMat);
  orbitLine.computeLineDistances();
  orbitLine.rotation.x = Math.PI / 4;
  orbitLine.rotation.y = Math.PI / 6;
  earthGroup.add(orbitLine);

  const satMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.02, 0.06),
    new THREE.MeshBasicMaterial({ color: 0xb9ed73 })
  );
  earthGroup.add(satMesh);

  let isDragging = false;
  let prevMousePos = { x: 0, y: 0 };
  let targetRotationX = (focusLat / 90) * 0.65;
  let targetRotationY = -((focusLon + 90) * (Math.PI / 180));

  function applyMode(mode) {
    if (mode === 'aerosol') {
      wireMat.opacity = 0.08;
      atmosMesh.scale.set(1.06, 1.06, 1.06);
      markerGroup.visible = true;
      orbitLine.visible = true;
    } else if (mode === 'nodes') {
      wireMat.opacity = 0.36;
      atmosMesh.scale.set(1.0, 1.0, 1.0);
      markerGroup.visible = true;
      orbitLine.visible = false;
    } else {
      wireMat.opacity = 0.18;
      atmosMesh.scale.set(1.0, 1.0, 1.0);
      markerGroup.visible = true;
      orbitLine.visible = true;
    }
  }
  applyMode(initialMode);

  container.style.cursor = 'grab';

  const onMouseDown = (e) => {
    isDragging = true;
    prevMousePos = { x: e.clientX, y: e.clientY };
    container.style.cursor = 'grabbing';
  };

  const onMouseMove = (e) => {
    if (!isDragging) return;
    targetRotationY += (e.clientX - prevMousePos.x) * 0.005;
    targetRotationX = Math.max(
      -1.2,
      Math.min(1.2, targetRotationX + (e.clientY - prevMousePos.y) * 0.005)
    );
    prevMousePos = { x: e.clientX, y: e.clientY };
  };

  const onMouseUp = () => {
    isDragging = false;
    container.style.cursor = 'grab';
  };

  const onResize = () => {
    const w = container.clientWidth || 420;
    const h = container.clientHeight || 360;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };

  container.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('resize', onResize);

  const clock = new THREE.Clock();
  let frameId = null;

  const animate = () => {
    frameId = requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();

    if (!isDragging && !prefersReducedMotion) {
      targetRotationY += 0.0012;
    }

    earthGroup.rotation.y += (targetRotationY - earthGroup.rotation.y) * 0.08;
    earthGroup.rotation.x += (targetRotationX - earthGroup.rotation.x) * 0.08;

    if (!prefersReducedMotion) {
      rings.forEach((r, idx) => {
        const scale = 1 + Math.sin(elapsedTime * 3 + idx) * 0.35;
        r.mesh.scale.set(scale, scale, scale);
        r.mesh.material.opacity = Math.max(0.1, 0.9 - (scale - 1) * 1.5);
      });
    }

    const satAngle = prefersReducedMotion ? 0.6 : elapsedTime * 0.45;
    satMesh.position
      .set(Math.cos(satAngle) * 1.35, 0, Math.sin(satAngle) * 1.35)
      .applyAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 4)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 6);

    renderer.render(scene, camera);
  };

  animate();

  const cleanup = () => {
    if (frameId !== null) cancelAnimationFrame(frameId);
    container.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('resize', onResize);
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
    renderer.dispose();
  };

  cleanup.setMode = applyMode;
  cleanup.focusCoords = (lat, lon) => {
    targetRotationX = (lat / 90) * 0.65;
    targetRotationY = -((lon + 90) * (Math.PI / 180));
  };

  return cleanup;
}
