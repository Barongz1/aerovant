// AEROVANT — Hangar 3D Preview & Map/Mode Selection UI

window.AeroHangar = (() => {
  const M = window.AeroMath;

  let selectedPlaneId = 'veltrix';
  let selectedMapId = 'nusantara';
  let selectedModeId = 'corridor';
  let activeTab = 'hangar';
  let previewLoadedKey = '';
  let mapPreviewTime = 0;
  let turntableMesh = null;

  function ensureMapPreview(resetAnim = false) {
    const key = `${selectedMapId}:${selectedModeId}`;
    if (previewLoadedKey !== key || resetAnim) {
      if (previewLoadedKey !== key) {
        window.AeroWorld.load(getSelectedMap(), getSelectedMode());
        previewLoadedKey = key;
      }
      mapPreviewTime = 0;
    }
  }

  function getSelectedPlane() {
    return window.AeroData.PLANES.find((p) => p.id === selectedPlaneId) || window.AeroData.PLANES[0];
  }

  function getSelectedMap() {
    return window.AeroData.MAPS.find((m) => m.id === selectedMapId) || window.AeroData.MAPS[0];
  }

  function getSelectedMode() {
    return window.AeroData.MODES.find((m) => m.id === selectedModeId) || window.AeroData.MODES[0];
  }

  function buildTurntable() {
    if (turntableMesh) return;
    const mb = window.AeroGL.MeshBuilder();
    mb.addCylinder(0, -0.35, 0, 10.5, 11.2, 0.7, 32, [0.16, 0.20, 0.27]);
    mb.addCylinder(0, -0.02, 0, 9.6, 9.6, 0.08, 32, [0.92, 0.62, 0.14]);
    mb.addBox(0, -0.75, 0, 60, 0.2, 60, [0.08, 0.10, 0.14]);
    turntableMesh = mb.build();
  }

  function renderUI() {
    const plane = getSelectedPlane();
    const map = getSelectedMap();
    const mode = getSelectedMode();

    document.getElementById('summary-map-name').textContent = map.name;
    document.getElementById('summary-mode-name').textContent = mode.name;
    const best = Number(localStorage.getItem('aerovant_best_score') || 0);
    const bestEl = document.getElementById('summary-best-score');
    if (bestEl) bestEl.textContent = best;

    document.getElementById('hangar-plane-role').textContent = plane.role;
    document.getElementById('hangar-plane-name').textContent = plane.name;
    document.getElementById('hangar-plane-desc').textContent = plane.desc;

    // Render 3 Plane Cards
    const planeContainer = document.getElementById('plane-cards-container');
    planeContainer.innerHTML = window.AeroData.PLANES.map((p) => {
      const sel = p.id === selectedPlaneId ? 'selected' : '';
      return `
        <div class="plane-card ${sel}" data-plane-id="${p.id}">
          <div class="plane-card-head">
            <div class="plane-card-name">${p.name}</div>
            <div class="plane-card-tag">${p.tag}</div>
          </div>
          <div class="stat-row">
            <span>SPEED</span>
            <div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${(p.stats.speed / 20) * 100}%"></div></div>
            <span class="stat-val">${p.stats.speed}</span>
          </div>
          <div class="stat-row">
            <span>HANDLING</span>
            <div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${(p.stats.handling / 20) * 100}%"></div></div>
            <span class="stat-val">${p.stats.handling}</span>
          </div>
          <div class="stat-row">
            <span>AKSELERASI</span>
            <div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${(p.stats.accel / 20) * 100}%"></div></div>
            <span class="stat-val">${p.stats.accel}</span>
          </div>
          <div class="stat-row">
            <span>STABILITAS</span>
            <div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${(p.stats.stability / 20) * 100}%"></div></div>
            <span class="stat-val">${p.stats.stability}</span>
          </div>
        </div>
      `;
    }).join('');

    planeContainer.querySelectorAll('.plane-card').forEach((card) => {
      card.addEventListener('click', () => {
        selectedPlaneId = card.dataset.planeId;
        window.AeroPlane.state.plane = getSelectedPlane();
        renderUI();
      });
    });

    // Render 3 Mode Cards
    const modeContainer = document.getElementById('mode-cards-container');
    modeContainer.innerHTML = window.AeroData.MODES.map((m) => `
      <div class="mode-card ${m.id === selectedModeId ? 'selected' : ''}" data-mode-id="${m.id}">
        <h3>${m.name}</h3>
        <p>${m.desc}</p>
      </div>
    `).join('');

    modeContainer.querySelectorAll('.mode-card').forEach((card) => {
      card.addEventListener('click', () => {
        selectedModeId = card.dataset.modeId;
        if (activeTab === 'maps') ensureMapPreview();
        renderUI();
      });
    });

    // Render 5 Map Cards
    const mapContainer = document.getElementById('map-cards-container');
    mapContainer.innerHTML = window.AeroData.MAPS.map((mp) => `
      <div class="map-card ${mp.id === selectedMapId ? 'selected' : ''}" data-map-id="${mp.id}">
        <div class="map-swatch" style="background-image: linear-gradient(180deg, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.72) 100%), url('${mp.image}'); background-size: cover; background-position: center;">${mp.tag}</div>
        <div class="map-card-body">
          <h3>${mp.name}</h3>
          <p>${mp.desc}</p>
        </div>
      </div>
    `).join('');

    mapContainer.querySelectorAll('.map-card').forEach((card) => {
      card.addEventListener('click', () => {
        selectedMapId = card.dataset.mapId;
        if (activeTab === 'maps') ensureMapPreview();
        renderUI();
      });
    });
  }

  function init(onLaunch) {
    buildTurntable();
    window.AeroPlane.reset(getSelectedPlane(), true);
    renderUI();

    const tabHangar = document.getElementById('btn-tab-hangar');
    const tabMaps = document.getElementById('btn-tab-maps');
    const panelHangar = document.getElementById('panel-hangar');
    const panelMaps = document.getElementById('panel-maps');

    tabHangar.addEventListener('click', () => {
      activeTab = 'hangar';
      tabHangar.classList.add('active');
      tabMaps.classList.remove('active');
      panelHangar.classList.remove('hidden');
      panelMaps.classList.add('hidden');
    });

    tabMaps.addEventListener('click', () => {
      activeTab = 'maps';
      ensureMapPreview(true);
      tabMaps.classList.add('active');
      tabHangar.classList.remove('active');
      panelMaps.classList.remove('hidden');
      panelHangar.classList.add('hidden');
    });

    document.getElementById('btn-launch-flight').addEventListener('click', () => {
      onLaunch(getSelectedPlane(), getSelectedMap(), getSelectedMode());
    });
  }

  function render3D(proj, time, dt = 0.016) {
    if (activeTab === 'maps') {
      ensureMapPreview(false);
      mapPreviewTime += dt;
      // Resetting scenic fly-in & gentle pan starting from the best front-facing angle
      const t = mapPreviewTime;
      const sway = Math.sin(t * 0.22) * 140;
      const advance = Math.min(t * 28, 380);
      const camPos = {
        x: sway,
        y: 185 + Math.sin(t * 0.3) * 15,
        z: 240 - advance,
      };
      const target = { x: sway * 0.35, y: 50, z: -780 };
      const view = M.mat4LookAt(camPos, target, { x: 0, y: 1, z: 0 });
      const dir = M.sub(target, camPos);
      const viewRot = M.mat4LookAt({ x: 0, y: 0, z: 0 }, dir, { x: 0, y: 1, z: 0 });
      window.AeroWorld.render(proj, view, viewRot, camPos, time, camPos, dt, true);
      return;
    }
    const gl = window.AeroGL.gl;
    const progs = window.AeroGL.programs;
    const camPos = { x: 8.5, y: 4.5, z: 12.5 };
    const view = M.mat4LookAt(camPos, { x: 0, y: 1.4, z: 0 }, { x: 0, y: 1, z: 0 });
    const viewRot = M.mat4LookAt({ x: 0, y: 0, z: 0 }, { x: -8.5, y: -3.1, z: -12.5 }, { x: 0, y: 1, z: 0 });

    // Sky background
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(progs.sky);
    gl.uniformMatrix4fv(gl.getUniformLocation(progs.sky, 'uProj'), false, proj);
    gl.uniformMatrix4fv(gl.getUniformLocation(progs.sky, 'uViewRot'), false, viewRot);
    gl.uniform3fv(gl.getUniformLocation(progs.sky, 'uSkyTop'), [0.05, 0.08, 0.14]);
    gl.uniform3fv(gl.getUniformLocation(progs.sky, 'uSkyHorizon'), [0.16, 0.22, 0.34]);
    gl.uniform3fv(gl.getUniformLocation(progs.sky, 'uSunDir'), [0.4, 0.5, 0.7]);
    gl.uniform3fv(gl.getUniformLocation(progs.sky, 'uSunColor'), [1.0, 0.75, 0.35]);
    gl.uniform1f(gl.getUniformLocation(progs.sky, 'uStars'), 0.2);
    if (!window._skyCube) window._skyCube = window.AeroGL.createSkyCube();
    window.AeroGL.drawMesh(window._skyCube);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.depthFunc(gl.LESS);

    // Turntable
    const ident = M.mat4Identity();
    gl.useProgram(progs.lit);
    gl.uniformMatrix4fv(gl.getUniformLocation(progs.lit, 'uProj'), false, proj);
    gl.uniformMatrix4fv(gl.getUniformLocation(progs.lit, 'uView'), false, view);
    gl.uniformMatrix4fv(gl.getUniformLocation(progs.lit, 'uModel'), false, ident);
    gl.uniformMatrix3fv(gl.getUniformLocation(progs.lit, 'uNormalMat'), false, M.mat4NormalMatrix(ident));
    gl.uniform3fv(gl.getUniformLocation(progs.lit, 'uCamPos'), [camPos.x, camPos.y, camPos.z]);
    gl.uniform3fv(gl.getUniformLocation(progs.lit, 'uSunDir'), [0.5, 0.7, 0.5]);
    gl.uniform3fv(gl.getUniformLocation(progs.lit, 'uSunColor'), [1.0, 0.96, 0.90]);
    gl.uniform3fv(gl.getUniformLocation(progs.lit, 'uSkyColor'), [0.32, 0.38, 0.50]);
    gl.uniform3fv(gl.getUniformLocation(progs.lit, 'uGroundColor'), [0.20, 0.22, 0.26]);
    gl.uniform3fv(gl.getUniformLocation(progs.lit, 'uFogColor'), [0.08, 0.10, 0.16]);
    gl.uniform1f(gl.getUniformLocation(progs.lit, 'uFogDensity'), 0.0001);
    gl.uniform1f(gl.getUniformLocation(progs.lit, 'uSpecular'), 0.3);
    gl.uniform3fv(gl.getUniformLocation(progs.lit, 'uEmissive'), [0, 0, 0]);
    window.AeroGL.drawMesh(turntableMesh);

    // Spinning Aircraft
    window.AeroPlane.state.propSpin = time * 18;
    window.AeroPlane.render(proj, view, camPos, time, true);
  }

  return {
    init,
    render3D,
    getSelectedPlane,
    getSelectedMap,
    getSelectedMode,
  };
})();
