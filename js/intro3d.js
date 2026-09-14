/* =========================================================================
   Diamond Paints — Cinematic Villa-to-Interior Hero
   Drone-style 360° orbit over a luxury villa, a smooth approach to the
   entrance, the front door swinging open, and the camera travelling
   through the doorway into a lit premium interior — where the homepage
   itself (nav, headline, buttons) elegantly reveals. Runs once per
   browser session on the homepage; always skippable; respects
   prefers-reduced-motion; scales down on lower-power / small screens.
   ========================================================================= */
(function () {
  var hero = document.getElementById('cinema-hero');
  if (!hero) return; // only present on index.html

  var canvas    = document.getElementById('intro-canvas');
  var skipBtn   = document.getElementById('intro-skip');
  var loading   = document.getElementById('intro-loading');
  var veil      = document.getElementById('cinema-veil');
  var content   = document.getElementById('cinema-content');
  var scrollCue = document.getElementById('scroll-cue');
  var nav       = document.getElementById('site-nav');

  var STORAGE_KEY = 'dp_intro_played_v3';

  var running = false;
  var ended = false;

  function revealContent() {
    if (nav) nav.classList.add('nav-in');
    if (content) content.classList.add('in');
    if (scrollCue) scrollCue.classList.add('in');
  }

  function unlockScroll(markPlayed) {
    document.body.classList.remove('intro-lock');
    if (markPlayed) {
      try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
    }
  }

  function showStaticFallback(markPlayed) {
    if (ended) return;
    ended = true;
    running = false;
    hero.style.height = 'auto';
    hero.style.minHeight = '0';
    hero.classList.add('static-ready');
    if (loading) loading.style.display = 'none';
    if (skipBtn) skipBtn.style.display = 'none';
    revealContent();
    unlockScroll(markPlayed);
  }

  // Debug/testing escape hatch: add ?intro=force (or #intro=force) to the URL
  // to always play the full animation, ignoring prefers-reduced-motion and
  // the "already played this session" flag. Useful while iterating on the
  // scene, since a plain refresh does NOT clear sessionStorage on its own.
  var forcePlay = /[?&#]intro=force\b/.test(window.location.href);
  if (forcePlay) {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  // Bail out immediately (no 3D build at all) if there's nothing to gain from it.
  var reduceMotion = !forcePlay && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var skippedByFlag = !forcePlay && document.documentElement.getAttribute('data-intro') === 'skip';

  if (reduceMotion || skippedByFlag) {
    console.info('[Diamond Paints hero] Skipping animated intro — reason:',
      reduceMotion ? 'prefers-reduced-motion is enabled on this device/browser' :
      'already played this session (sessionStorage "' + STORAGE_KEY + '"). Add ?intro=force to the URL to replay it.');
    showStaticFallback(false);
    return;
  }
  if (typeof THREE === 'undefined') {
    console.warn('[Diamond Paints hero] THREE.js did not load (js/vendor/three.min.js) — showing static hero this time, will retry next load.');
    showStaticFallback(false);
    return;
  }
  console.info('[Diamond Paints hero] Playing cinematic intro.' + (forcePlay ? ' (forced via ?intro=force)' : ''));

  document.body.classList.add('intro-lock');
  if (skipBtn) {
    skipBtn.addEventListener('click', function () { skipToEnd(); });
    window.setTimeout(function () { skipBtn.classList.add('show'); }, 1000);
  }

  var renderer, scene, camera, clock;
  var lowPower = window.innerWidth < 860 || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  var isPhone  = window.innerWidth < 640;

  var outdoorGroup, interiorGroup, houseGroup;
  var doorLPivot, doorRPivot;
  var doorLight; // warm point light that spills through the doorway as it opens

  /* ---------------------------- OUTDOOR SCENE ---------------------------- */

  function buildSky() {
    var geo = new THREE.SphereGeometry(220, 24, 16);
    var mat = new THREE.ShaderMaterial({
      uniforms: {
        topColor:    { value: new THREE.Color(0x1c2e4a) },
        bottomColor: { value: new THREE.Color(0xf6c98b) },
        offset:      { value: 24 },
        exponent:    { value: 0.75 }
      },
      vertexShader: [
        'varying vec3 vWorldPosition;',
        'void main() {',
        '  vec4 wp = modelMatrix * vec4(position, 1.0);',
        '  vWorldPosition = wp.xyz;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 topColor;',
        'uniform vec3 bottomColor;',
        'uniform float offset;',
        'uniform float exponent;',
        'varying vec3 vWorldPosition;',
        'void main() {',
        '  float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;',
        '  gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);',
        '}'
      ].join('\n'),
      side: THREE.BackSide
    });
    return new THREE.Mesh(geo, mat);
  }

  function buildOutdoorLights() {
    var hemi = new THREE.HemisphereLight(0xbcd4ff, 0x3a2f22, 0.65);
    outdoorGroup.add(hemi);

    var sun = new THREE.DirectionalLight(0xffd7a3, 1.35);
    sun.position.set(-22, 26, 18);
    sun.castShadow = !lowPower;
    if (sun.castShadow) {
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.left = -28;
      sun.shadow.camera.right = 28;
      sun.shadow.camera.top = 28;
      sun.shadow.camera.bottom = -28;
      sun.shadow.camera.far = 80;
      sun.shadow.bias = -0.0015;
    }
    outdoorGroup.add(sun);

    var fill = new THREE.DirectionalLight(0x6f8fd1, 0.25);
    fill.position.set(18, 10, -20);
    outdoorGroup.add(fill);
  }

  function buildGround() {
    var grass = new THREE.Mesh(
      new THREE.CircleGeometry(60, lowPower ? 28 : 48),
      new THREE.MeshStandardMaterial({ color: 0x3c5c3f, roughness: 1 })
    );
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    outdoorGroup.add(grass);

    var drive = new THREE.Mesh(
      new THREE.PlaneGeometry(5.4, 16),
      new THREE.MeshStandardMaterial({ color: 0xb9b3a6, roughness: 0.9 })
    );
    drive.rotation.x = -Math.PI / 2;
    drive.position.set(0, 0.01, 11);
    drive.receiveShadow = true;
    outdoorGroup.add(drive);

    var court = new THREE.Mesh(
      new THREE.CircleGeometry(6, 32),
      new THREE.MeshStandardMaterial({ color: 0xb9b3a6, roughness: 0.9 })
    );
    court.rotation.x = -Math.PI / 2;
    court.position.set(0, 0.012, 6.5);
    court.receiveShadow = true;
    outdoorGroup.add(court);

    var pool = new THREE.Mesh(
      new THREE.BoxGeometry(9, 0.15, 4.2),
      new THREE.MeshStandardMaterial({ color: 0x1c6f8a, roughness: 0.08, metalness: 0.35, emissive: 0x0d3a4a, emissiveIntensity: 0.35 })
    );
    pool.position.set(7.6, 0.07, 3);
    outdoorGroup.add(pool);

    var poolEdge = new THREE.Mesh(
      new THREE.BoxGeometry(9.6, 0.2, 4.8),
      new THREE.MeshStandardMaterial({ color: 0xe7e2d6, roughness: 0.85 })
    );
    poolEdge.position.set(7.6, 0.02, 3);
    outdoorGroup.add(poolEdge);
  }

  function glassMaterial() {
    return new THREE.MeshStandardMaterial({
      color: 0x223347,
      roughness: 0.15,
      metalness: 0.2,
      emissive: 0xffd9a0,
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0.92
    });
  }

  function addWindowGrid(parent, w, h, cols, rows, x, y, z, rotY) {
    var gapX = w / cols, gapY = h / rows;
    var group = new THREE.Group();
    for (var c = 0; c < cols; c++) {
      for (var r = 0; r < rows; r++) {
        var pane = new THREE.Mesh(new THREE.BoxGeometry(gapX * 0.78, gapY * 0.72, 0.08), glassMaterial());
        pane.position.set(-w / 2 + gapX * (c + 0.5), -h / 2 + gapY * (r + 0.5), 0);
        group.add(pane);
      }
    }
    group.position.set(x, y, z);
    group.rotation.y = rotY || 0;
    parent.add(group);
  }

  function buildHouse() {
    houseGroup = new THREE.Group();

    var stucco     = new THREE.MeshStandardMaterial({ color: 0xece3d2, roughness: 0.85 });
    var stuccoDark = new THREE.MeshStandardMaterial({ color: 0xd8ccb2, roughness: 0.85 });
    var roofMat    = new THREE.MeshStandardMaterial({ color: 0x24252b, roughness: 0.5, metalness: 0.15 });
    var trim       = new THREE.MeshStandardMaterial({ color: 0xcaa15d, roughness: 0.35, metalness: 0.55 });
    var woodDoor   = new THREE.MeshStandardMaterial({ color: 0x2c1c12, roughness: 0.5, metalness: 0.1 });
    var openingMat = new THREE.MeshStandardMaterial({ color: 0x100c09, roughness: 0.95 });

    var base = new THREE.Mesh(new THREE.BoxGeometry(13, 4.2, 9), stucco);
    base.position.set(0, 2.1, 0);
    base.castShadow = base.receiveShadow = true;
    houseGroup.add(base);

    var upper = new THREE.Mesh(new THREE.BoxGeometry(8, 3.2, 6.4), stuccoDark);
    upper.position.set(-0.6, 5.9, -0.8);
    upper.castShadow = upper.receiveShadow = true;
    houseGroup.add(upper);

    var roof1 = new THREE.Mesh(new THREE.BoxGeometry(13.6, 0.3, 9.6), roofMat);
    roof1.position.set(0, 4.35, 0);
    roof1.castShadow = true;
    houseGroup.add(roof1);

    var roof2 = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.3, 7), roofMat);
    roof2.position.set(-0.6, 7.65, -0.8);
    roof2.castShadow = true;
    houseGroup.add(roof2);

    var trimBar = new THREE.Mesh(new THREE.BoxGeometry(13.05, 0.08, 9.05), trim);
    trimBar.position.set(0, 4.22, 0);
    houseGroup.add(trimBar);

    addWindowGrid(houseGroup, 3.6, 2.4, 3, 2, -4.1, 2.4, 4.52, 0);
    addWindowGrid(houseGroup, 3.6, 2.4, 3, 2, 4.1, 2.4, 4.52, 0);
    addWindowGrid(houseGroup, 6.4, 1.9, 5, 1, -0.6, 6.1, 2.52, 0);
    addWindowGrid(houseGroup, 6.5, 2.2, 4, 1, 6.52, 2.5, 1.5, Math.PI / 2);
    addWindowGrid(houseGroup, 6.5, 2.2, 4, 1, -6.52, 2.5, 1.5, -Math.PI / 2);

    var colGeo = new THREE.CylinderGeometry(0.28, 0.28, 4.1, lowPower ? 10 : 18);
    [-2.1, 2.1].forEach(function (x) {
      var col = new THREE.Mesh(colGeo, stucco);
      col.position.set(x, 2.05, 5.2);
      col.castShadow = true;
      houseGroup.add(col);
    });
    var porticoRoof = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.25, 2.2), stuccoDark);
    porticoRoof.position.set(0, 4.15, 5.2);
    houseGroup.add(porticoRoof);

    for (var s = 0; s < 3; s++) {
      var step = new THREE.Mesh(
        new THREE.BoxGeometry(4.4 - s * 0.3, 0.16, 0.9 - s * 0.1),
        new THREE.MeshStandardMaterial({ color: 0xdedad0, roughness: 0.9 })
      );
      step.position.set(0, 0.08 + s * 0.16, 4.7 + s * 0.35);
      step.receiveShadow = true;
      houseGroup.add(step);
    }

    // Doorway opening — dark until the door light spills across it.
    var opening = new THREE.Mesh(new THREE.PlaneGeometry(2.15, 2.75), openingMat);
    opening.position.set(0, 1.55, 4.5);
    houseGroup.add(opening);

    var doorSurround = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3.0, 0.12), trim);
    doorSurround.position.set(0, 1.55, 4.56);
    houseGroup.add(doorSurround);

    // Doors are hinged groups so they can swing open like real double doors.
    var doorGeo = new THREE.BoxGeometry(0.98, 2.55, 0.1);
    var handleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8);

    doorLPivot = new THREE.Group();
    doorLPivot.position.set(-1.01, 1.32, 4.62);
    var doorL = new THREE.Mesh(doorGeo, woodDoor);
    doorL.position.set(0.49, 0, 0);
    doorLPivot.add(doorL);
    var handleL = new THREE.Mesh(handleGeo, trim);
    handleL.rotation.z = Math.PI / 2;
    handleL.position.set(0.87, -0.02, 0.08);
    doorLPivot.add(handleL);
    houseGroup.add(doorLPivot);

    doorRPivot = new THREE.Group();
    doorRPivot.position.set(1.01, 1.32, 4.62);
    var doorR = new THREE.Mesh(doorGeo, woodDoor);
    doorR.position.set(-0.49, 0, 0);
    doorRPivot.add(doorR);
    var handleR = new THREE.Mesh(handleGeo, trim);
    handleR.rotation.z = Math.PI / 2;
    handleR.position.set(-0.87, -0.02, 0.08);
    doorRPivot.add(handleR);
    houseGroup.add(doorRPivot);

    var transom = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.5, 0.08), glassMaterial());
    transom.position.set(0, 2.85, 4.6);
    houseGroup.add(transom);

    [-1.5, 1.5].forEach(function (x) {
      var lantern = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0xffdca0, emissive: 0xffb15c, emissiveIntensity: 1.4 })
      );
      lantern.position.set(x, 2.6, 4.65);
      houseGroup.add(lantern);
      var lp = new THREE.PointLight(0xffb15c, 0.9, 6, 2);
      lp.position.copy(lantern.position);
      houseGroup.add(lp);
    });

    // Warm light that ramps up as the door opens, spilling onto the opening.
    doorLight = new THREE.PointLight(0xffcf9a, 0, 7, 2);
    doorLight.position.set(0, 1.7, 4.1);
    houseGroup.add(doorLight);

    outdoorGroup.add(houseGroup);
  }

  function buildLandscape() {
    var hedgeMat = new THREE.MeshStandardMaterial({ color: 0x2f5233, roughness: 1 });
    var trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4330, roughness: 1 });
    var leafMat  = new THREE.MeshStandardMaterial({ color: 0x3f6b3f, roughness: 0.9 });

    [-3.0, 3.0].forEach(function (x) {
      for (var i = -1; i < 4; i++) {
        var hedge = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 1.1), hedgeMat);
        hedge.position.set(x, 0.3, 6 + i * 2.1);
        hedge.castShadow = hedge.receiveShadow = true;
        outdoorGroup.add(hedge);
      }
    });

    var palmSpots = [[11.5, 1.2], [11.5, 5.4], [-9, -3], [9.5, -6]];
    palmSpots.forEach(function (p) {
      var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 3.2, 8), trunkMat);
      trunk.position.set(p[0], 1.6, p[1]);
      trunk.rotation.z = (Math.random() - 0.5) * 0.15;
      trunk.castShadow = true;
      outdoorGroup.add(trunk);
      for (var f = 0; f < 6; f++) {
        var frond = new THREE.Mesh(new THREE.ConeGeometry(0.25, 2.1, 6), leafMat);
        frond.position.set(p[0], 3.3, p[1]);
        frond.rotation.z = Math.PI / 2.4;
        frond.rotation.y = (Math.PI * 2 / 6) * f;
        frond.castShadow = true;
        outdoorGroup.add(frond);
      }
    });

    var shrubSpots = [[-6, 6.5], [6, 6.5], [-5.5, -4], [5.5, -4]];
    shrubSpots.forEach(function (p) {
      var shrub = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 10), leafMat);
      shrub.position.set(p[0], 0.7, p[1]);
      shrub.castShadow = shrub.receiveShadow = true;
      outdoorGroup.add(shrub);
    });
  }

  /* ---------------------------- INTERIOR SCENE ---------------------------- */
  // A simple, premium-feeling room built just inside the front door: warm
  // wood floor, soft painted walls, a deep feature wall, and minimal
  // furniture — enough to sell "beautiful, high-end paint advertisement"
  // without heavy geometry.

  var pendantLights = [];
  var windowFill;

  function buildInterior() {
    interiorGroup = new THREE.Group();
    interiorGroup.visible = false;

    var floorMat   = new THREE.MeshStandardMaterial({ color: 0x8a6b4a, roughness: 0.55 });
    var ceilingMat = new THREE.MeshStandardMaterial({ color: 0xfbf9f4, roughness: 0.95 });
    var wallMat    = new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.92, side: THREE.DoubleSide });
    var featureMat = new THREE.MeshStandardMaterial({ color: 0x18332e, roughness: 0.55, side: THREE.DoubleSide });
    var trimMat    = new THREE.MeshStandardMaterial({ color: 0xcaa15d, roughness: 0.35, metalness: 0.55 });
    var sofaMat    = new THREE.MeshStandardMaterial({ color: 0xd8d1c2, roughness: 0.8 });
    var woodMat    = new THREE.MeshStandardMaterial({ color: 0x4a3527, roughness: 0.5 });
    var artMat     = new THREE.MeshStandardMaterial({ color: 0x2ecc63, roughness: 0.6, emissive: 0x123a24, emissiveIntensity: 0.15 });

    var floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 9), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.02, 0);
    floor.receiveShadow = true;
    interiorGroup.add(floor);

    var ceiling = new THREE.Mesh(new THREE.PlaneGeometry(12, 9), ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 4.0, 0);
    interiorGroup.add(ceiling);

    var backWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 4), featureMat);
    backWall.position.set(0, 2.0, -4.3);
    interiorGroup.add(backWall);

    var leftWall = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 4), wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-6.0, 2.0, 0);
    interiorGroup.add(leftWall);

    var rightWall = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 4), wallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(6.0, 2.0, 0);
    interiorGroup.add(rightWall);

    // Gold skirting line where the floor meets the feature wall.
    var skirt = new THREE.Mesh(new THREE.BoxGeometry(12, 0.06, 0.05), trimMat);
    skirt.position.set(0, 0.06, -4.28);
    interiorGroup.add(skirt);

    // Large bright window on the right wall — the "warm daylight" source.
    var windowGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(3, 2.2),
      new THREE.MeshStandardMaterial({ color: 0xfff2d6, emissive: 0xffe3ab, emissiveIntensity: 1, side: THREE.DoubleSide })
    );
    windowGlow.rotation.y = -Math.PI / 2;
    windowGlow.position.set(5.96, 2.2, -1.2);
    interiorGroup.add(windowGlow);
    var frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    [ -1.1, 1.1 ].forEach(function (z) {
      var mullion = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.2, 0.06), frameMat);
      mullion.rotation.y = -Math.PI / 2;
      mullion.position.set(5.95, 2.2, -1.2 + z);
      interiorGroup.add(mullion);
    });

    windowFill = new THREE.PointLight(0xffdca0, 0, 10, 2);
    windowFill.position.set(5.3, 2.3, -1.2);
    interiorGroup.add(windowFill);

    // Framed "art" panel on the feature wall — a nod to colour on the wall.
    var art = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.3), artMat);
    art.position.set(-2.4, 2.3, -4.27);
    interiorGroup.add(art);

    // Low sofa + coffee table, simple boxes for a furnished feel.
    var sofaBase = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 0.9), sofaMat);
    sofaBase.position.set(1.6, 0.27, -2.6);
    sofaBase.castShadow = sofaBase.receiveShadow = true;
    interiorGroup.add(sofaBase);
    var sofaBack = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.55, 0.22), sofaMat);
    sofaBack.position.set(1.6, 0.65, -3.0);
    interiorGroup.add(sofaBack);

    var tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.6), woodMat);
    tableTop.position.set(1.6, 0.36, -1.5);
    tableTop.castShadow = true;
    interiorGroup.add(tableTop);
    var legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.34, 8);
    [[-0.48,-0.24],[0.48,-0.24],[-0.48,0.24],[0.48,0.24]].forEach(function (o) {
      var leg = new THREE.Mesh(legGeo, trimMat);
      leg.position.set(1.6 + o[0], 0.17, -1.5 + o[1]);
      interiorGroup.add(leg);
    });

    // Pendant lights hanging from the ceiling — warm accent glow.
    [[-1.4, -1.0], [1.6, -3.4]].forEach(function (p) {
      var wire = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1.1, 6), new THREE.MeshStandardMaterial({ color: 0x222222 }));
      wire.position.set(p[0], 3.4, p[1]);
      interiorGroup.add(wire);
      var bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0xffdca0, emissive: 0xffb15c, emissiveIntensity: 0 })
      );
      bulb.position.set(p[0], 2.85, p[1]);
      interiorGroup.add(bulb);
      var pl = new THREE.PointLight(0xffb767, 0, 6, 2);
      pl.position.copy(bulb.position);
      interiorGroup.add(pl);
      pendantLights.push({ bulb: bulb, light: pl });
    });

    var ambient = new THREE.AmbientLight(0xfff3e2, 0);
    interiorGroup.add(ambient);
    interiorGroup.userData.ambient = ambient;

    scene.add(interiorGroup);
  }

  function setInteriorLit(intensity) {
    // intensity: 0..1 — ramps the interior from dark to fully lit.
    if (interiorGroup.userData.ambient) interiorGroup.userData.ambient.intensity = 0.55 * intensity;
    if (windowFill) windowFill.intensity = 1.1 * intensity;
    pendantLights.forEach(function (p) {
      p.light.intensity = 1.3 * intensity;
      p.bulb.material.emissiveIntensity = 1.4 * intensity;
    });
  }

  /* ---------------------------- SETUP ---------------------------- */

  function init() {
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !lowPower, alpha: false, powerPreference: 'high-performance' });
    } catch (e) {
      console.warn('[Diamond Paints hero] WebGL init failed — showing static hero this time.', e);
      showStaticFallback(false);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.4 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = !lowPower;
    if (renderer.shadowMap.enabled) renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();

    outdoorGroup = new THREE.Group();
    scene.add(outdoorGroup);
    outdoorGroup.add(buildSky());
    scene.fog = new THREE.Fog(0xf4cf9e, 34, 95);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 500);

    buildOutdoorLights();
    buildGround();
    buildHouse();
    if (!lowPower) buildLandscape();
    buildInterior();

    clock = new THREE.Clock();
    running = true;

    window.addEventListener('resize', onResize);

    loading.style.opacity = '0';
    window.setTimeout(function () { loading.style.display = 'none'; }, 500);

    requestAnimationFrame(animate);
  }

  function onResize() {
    if (!renderer || !camera) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /* ---------------------------- TIMELINE ---------------------------- */

  function smoothstep(t) { return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  var DUR = lowPower
    ? { orbit: 4.4, approach: 2.0, doorHold: 1.1, enter: 1.7, settle: 0.9 }
    : { orbit: 7.5, approach: 3.0, doorHold: 1.5, enter: 1.9, settle: 1.0 };

  var T1 = DUR.orbit;
  var T2 = T1 + DUR.approach;
  var T3 = T2 + DUR.doorHold;
  var T4 = T3 + DUR.enter;
  var T5 = T4 + DUR.settle;

  var DOOR_OPEN_ANGLE = 1.7; // ~97°

  var IDLE_POS  = { x: -0.7, y: 1.68, z: 0.4 };
  var IDLE_LOOK = { x: 1.1, y: 1.75, z: -3.6 };

  var revealed = false;
  var lookTarget = new THREE.Vector3();
  var idleStart = 0;

  function crossThreshold() {
    outdoorGroup.visible = false;
    interiorGroup.visible = true;
  }

  function doReveal() {
    if (revealed) return;
    revealed = true;
    revealContent();
    unlockScroll(true);
  }

  function skipToEnd() {
    if (ended) return;
    doorLPivot.rotation.y = -DOOR_OPEN_ANGLE;
    doorRPivot.rotation.y = DOOR_OPEN_ANGLE;
    doorLight.intensity = 0;
    crossThreshold();
    setInteriorLit(1);
    camera.position.set(IDLE_POS.x, IDLE_POS.y, IDLE_POS.z);
    lookTarget.set(IDLE_LOOK.x, IDLE_LOOK.y, IDLE_LOOK.z);
    camera.lookAt(lookTarget);
    camera.fov = 58;
    camera.updateProjectionMatrix();
    veil.style.opacity = '0';
    if (skipBtn) skipBtn.classList.remove('show');
    ended = true;
    doReveal();
    idleStart = clock.getElapsedTime();
    requestAnimationFrame(idleLoop);
  }

  function animate() {
    if (!running) return;
    var t = clock.getElapsedTime();

    if (t <= T1) {
      // 360° aerial drone orbit around the villa.
      var p = t / T1;
      var angle = p * Math.PI * 2;
      var radius = lerp(21, 15.5, smoothstep(p));
      var height = lerp(12.5, 8, smoothstep(p));
      camera.position.set(Math.sin(angle) * radius, height, Math.cos(angle) * radius);
      lookTarget.set(0, 2.4 - p * 0.6, 0);
      camera.lookAt(lookTarget);
      camera.fov = 45;
      camera.updateProjectionMatrix();

    } else if (t <= T2) {
      // Descend and move toward the entrance.
      var p2 = (t - T1) / DUR.approach;
      var e2 = smoothstep(p2);
      camera.position.set(lerp(0, 0, e2), lerp(8, 2.4, e2), lerp(15.5, 8.6, e2));
      lookTarget.set(0, lerp(2.1, 1.65, e2), lerp(0, 4.4, e2));
      camera.lookAt(lookTarget);
      camera.fov = lerp(45, 52, e2);
      camera.updateProjectionMatrix();

    } else if (t <= T3) {
      // Hold near the entrance while the doors swing open, light spilling out.
      var p3 = (t - T2) / DUR.doorHold;
      var e3 = smoothstep(p3);
      camera.position.set(0, 2.4, lerp(8.6, 7.2, e3));
      lookTarget.set(0, 1.65, 4.5);
      camera.lookAt(lookTarget);
      doorLPivot.rotation.y = -DOOR_OPEN_ANGLE * e3;
      doorRPivot.rotation.y = DOOR_OPEN_ANGLE * e3;
      doorLight.intensity = 3.2 * e3;

    } else if (t <= T4) {
      // Travel through the doorway into the interior. A brief warm flash
      // (the veil) masks the moment the camera crosses the threshold, so
      // the exterior-to-interior swap reads as "stepping into the light"
      // rather than a hard cut.
      var p4 = (t - T3) / DUR.enter;
      var e4 = smoothstep(p4);
      camera.position.set(lerp(0, IDLE_POS.x, e4), lerp(2.4, IDLE_POS.y, e4), lerp(7.2, IDLE_POS.z, e4));
      lookTarget.set(lerp(0, IDLE_LOOK.x, e4), lerp(1.65, IDLE_LOOK.y, e4), lerp(4.5, IDLE_LOOK.z, e4));
      camera.lookAt(lookTarget);
      camera.fov = lerp(52, 60, e4);
      camera.updateProjectionMatrix();

      if (p4 < 0.35) {
        veil.style.opacity = '0';
      } else if (p4 < 0.55) {
        veil.style.opacity = String(smoothstep((p4 - 0.35) / 0.2));
      } else if (p4 < 0.62) {
        veil.style.opacity = '1';
        if (!interiorGroup.visible) crossThreshold();
      } else if (p4 < 0.92) {
        veil.style.opacity = String(1 - smoothstep((p4 - 0.62) / 0.3));
        setInteriorLit(smoothstep((p4 - 0.62) / 0.3));
      } else {
        veil.style.opacity = '0';
        setInteriorLit(1);
      }

    } else if (t <= T5) {
      // Settle into the final resting frame; door light fades as room lighting takes over.
      var p5 = (t - T4) / DUR.settle;
      var e5 = smoothstep(p5);
      camera.position.set(IDLE_POS.x, IDLE_POS.y, IDLE_POS.z);
      lookTarget.set(IDLE_LOOK.x, IDLE_LOOK.y, IDLE_LOOK.z);
      camera.lookAt(lookTarget);
      camera.fov = lerp(60, 58, e5);
      camera.updateProjectionMatrix();
      setInteriorLit(1);

    } else {
      running = false;
      doReveal();
      idleStart = t;
      requestAnimationFrame(idleLoop);
      renderer.render(scene, camera);
      return;
    }

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  // Gentle, inexpensive breathing motion once inside — a living backdrop
  // for the homepage content rather than a static frame.
  function idleLoop() {
    if (ended && !running && !document.hidden) {
      var t = clock.getElapsedTime() - idleStart;
      camera.position.set(
        IDLE_POS.x + Math.sin(t * 0.12) * 0.06,
        IDLE_POS.y + Math.sin(t * 0.09) * 0.03,
        IDLE_POS.z
      );
      lookTarget.set(IDLE_LOOK.x + Math.sin(t * 0.1) * 0.1, IDLE_LOOK.y, IDLE_LOOK.z);
      camera.lookAt(lookTarget);
      renderer.render(scene, camera);
    }
    requestAnimationFrame(idleLoop);
  }

  init();
})();
