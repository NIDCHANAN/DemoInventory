import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

(() => {
  const $ = id => document.getElementById(id);
  const host = $("warehouse3d");

  function fail(message, err) {
    console.error("[Inventory 3D]", message, err || "");
    if (host) host.innerHTML = `<div style="min-height:280px;height:100%;display:grid;place-content:center;text-align:center;padding:24px;color:#173b63"><b>3D Warehouse could not start</b><div style="margin-top:8px">${message}</div><small style="margin-top:8px">กด F12 → Console เพื่อดูรายละเอียด</small></div>`;
  }

  function clock() {
    const now = new Date();
    if ($("clock")) $("clock").textContent = now.toLocaleTimeString("en-GB");
    if ($("dateText")) $("dateText").textContent = now.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"2-digit",year:"numeric"}).toUpperCase();
    if ($("lastUpdate")) $("lastUpdate").textContent = now.toLocaleTimeString("en-GB");
  }
  clock(); setInterval(clock,1000);

  if (!host) { console.error('Missing #warehouse3d element'); return; }

  try {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xc9e5fb);
    scene.fog = new THREE.Fog(0xc9e5fb,32,75);

    const camera = new THREE.PerspectiveCamera(42,Math.max(host.clientWidth,320)/Math.max(host.clientHeight,240),0.1,150);
    camera.position.set(19,16,22);

    const renderer = new THREE.WebGLRenderer({antialias:true,alpha:false});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
    renderer.setSize(Math.max(host.clientWidth,320),Math.max(host.clientHeight,240));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.innerHTML = "";
    host.style.position = "relative";
    host.style.overflow = "hidden";
    renderer.domElement.style.cssText = "display:block;width:100%;height:100%;cursor:grab;touch-action:none";
    host.appendChild(renderer.domElement);

    const infoPanel = document.createElement("div");
    infoPanel.id = "rackInfoPanel";

    infoPanel.style.cssText = `
      position:absolute;
      top:14px;
      right:14px;
      width:270px;
      max-width:calc(100% - 28px);
      padding:18px;
      background:rgba(255,255,255,.94);
      backdrop-filter:blur(14px);
      border:1px solid rgba(255,255,255,.9);
      border-radius:16px;
      box-shadow:0 10px 35px rgba(20,65,110,.16);
      z-index:10;
      color:#173b63;
      pointer-events:none;
    `;

    infoPanel.innerHTML = `
      <div style="font-size:11px;font-weight:800;letter-spacing:1px;color:#6d89a6">
        SELECTED LOCATION
      </div>
      <div style="font-size:20px;font-weight:900;margin-top:5px">
        RACK A-01
      </div>
      <div style="margin-top:10px;color:#6d89a6;font-size:12px">
        Loading inventory...
      </div>
    `;

    host.appendChild(infoPanel);

    scene.add(new THREE.HemisphereLight(0xffffff,0x7899b9,2));
    const sun = new THREE.DirectionalLight(0xffffff,2.4);
    sun.position.set(12,22,14); sun.castShadow = true; sun.shadow.mapSize.set(1024,1024); scene.add(sun);
    const fill = new THREE.DirectionalLight(0x76c8ff,.9);
    fill.position.set(-12,10,-12); scene.add(fill);

    const mat = (c,r=.58,m=.08) => new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
    const steel=mat(0x245b8e,.38,.45), beam=mat(0x087fc2,.42,.3), dark=mat(0x153c61);
    const pallet=mat(0xb58a55);
    const cartons=[mat(0xe5eef7),mat(0xb9d5e9),mat(0xf0d9b5),mat(0xcbdde9),mat(0x9fc4df)];
    const colors={healthy:0x16bd83,low:0xffa32b,critical:0xf04462};
    const rackInventory = [
      { id:"A-01", status:"healthy", material:"Steel Coil", code:"RM-100", qty:1250, unit:"KG", capacity:78, levels:[
        {level:"Level 1", item:"Steel Coil", qty:400, unit:"KG"},
        {level:"Level 2", item:"Steel Coil", qty:350, unit:"KG"},
        {level:"Level 3", item:"Steel Coil", qty:500, unit:"KG"}
      ]},
      { id:"A-02", status:"healthy", material:"Aluminium Sheet", code:"RM-245", qty:850, unit:"PCS", capacity:65,
        levels:[{level:"Level 1",item:"Aluminium Sheet",qty:300,unit:"PCS"},{level:"Level 2",item:"Aluminium Sheet",qty:250,unit:"PCS"},{level:"Level 3",item:"Aluminium Sheet",qty:300,unit:"PCS"}]},
      { id:"A-03", status:"low", material:"Polymer Resin", code:"RM-120", qty:5, unit:"BAGS", capacity:18,
        levels:[{level:"Level 1",item:"Polymer Resin",qty:5,unit:"BAGS"}]},
      { id:"B-01", status:"low", material:"Copper Rod", code:"RM-310", qty:12, unit:"PCS", capacity:34,
        levels:[{level:"Level 1",item:"Copper Rod",qty:12,unit:"PCS"}]},
      { id:"B-02", status:"healthy", material:"Steel Plate", code:"RM-150", qty:920, unit:"KG", capacity:81,
        levels:[{level:"Level 1",item:"Steel Plate",qty:300,unit:"KG"},{level:"Level 2",item:"Steel Plate",qty:320,unit:"KG"},{level:"Level 3",item:"Steel Plate",qty:300,unit:"KG"}]},
      { id:"B-03", status:"low", material:"Plastic Pellets", code:"RM-220", qty:8, unit:"BAGS", capacity:27,
        levels:[{level:"Level 1",item:"Plastic Pellets",qty:8,unit:"BAGS"}]},
      { id:"C-01", status:"critical", material:"Industrial Adhesive", code:"RM-410", qty:0, unit:"PCS", capacity:16,
        levels:[{level:"Level 1",item:"Industrial Adhesive",qty:0,unit:"PCS"}]},
      { id:"C-02", status:"healthy", material:"Aluminium Coil", code:"RM-260", qty:740, unit:"KG", capacity:73,
        levels:[{level:"Level 1",item:"Aluminium Coil",qty:240,unit:"KG"},{level:"Level 2",item:"Aluminium Coil",qty:250,unit:"KG"},{level:"Level 3",item:"Aluminium Coil",qty:250,unit:"KG"}]},
      { id:"C-03", status:"critical", material:"Rubber Compound", code:"RM-510", qty:0, unit:"BAGS", capacity:12,
        levels:[{level:"Level 1",item:"Rubber Compound",qty:0,unit:"BAGS"}]},
      { id:"D-01", status:"healthy", material:"Stainless Steel", code:"RM-610", qty:1100, unit:"KG", capacity:69,
        levels:[{level:"Level 1",item:"Stainless Steel",qty:400,unit:"KG"},{level:"Level 2",item:"Stainless Steel",qty:350,unit:"KG"},{level:"Level 3",item:"Stainless Steel",qty:350,unit:"KG"}]},
      { id:"D-02", status:"low", material:"Chemical Powder", code:"RM-710", qty:7, unit:"BAGS", capacity:27,
        levels:[{level:"Level 1",item:"Chemical Powder",qty:7,unit:"BAGS"}]},
      { id:"D-03", status:"healthy", material:"Packaging Material", code:"PK-100", qty:2400, unit:"PCS", capacity:94,
        levels:[{level:"Level 1",item:"Packaging Material",qty:800,unit:"PCS"},{level:"Level 2",item:"Packaging Material",qty:800,unit:"PCS"},{level:"Level 3",item:"Packaging Material",qty:800,unit:"PCS"}]}
    ];

    const racks = [];

    function addBox(parent,x,y,z,w,h,d,material,cast=true) {
      const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
      mesh.position.set(x,y,z); mesh.castShadow=cast; mesh.receiveShadow=true; parent.add(mesh); return mesh;
    }

    const floor=new THREE.Mesh(new THREE.PlaneGeometry(38,31),mat(0xe8f4fc,.9,0));
    floor.rotation.x=-Math.PI/2; floor.position.y=-.08; floor.receiveShadow=true; scene.add(floor);
    const grid=new THREE.GridHelper(34,34,0x8eb9dc,0xc3dcef); grid.position.y=-.055; scene.add(grid);
    addBox(scene,0,1.5,-9.2,28,3,.22,mat(0xd4e8f7),false);
    for(let i=0;i<5;i++) addBox(scene,-11+i*5.5,1.05,-9.05,2.3,1.45,.08,mat(0x9fc5e2),false);

    let idx=0;
    for(let row=0;row<4;row++) for(let bay=0;bay<3;bay++) {
      const rack=new THREE.Group();
      rack.position.set(-7.6+bay*5.4,0,-5.5+row*3.7);
      const inventory = rackInventory[idx];
      const status = inventory.status;
      const rackName = inventory.id;

      rack.userData = {
        rackName,
        status,
        index: idx,
        inventory
      };
      for(let level=0;level<4;level++) {
        const y=.3+level*.9;
        addBox(rack,0,y,0,4.2,.14,.9,beam);
        addBox(rack,0,y+.09,.47,4.2,.04,.05,mat(0x56b9ed),false);
        if(level<3) for(let p=0;p<4;p++) {
          const x=-1.55+p*1.03;
          addBox(rack,x,y+.48,0,.82,.72,.68,cartons[(idx+p+level)%cartons.length]);
          addBox(rack,x,y+.48,.35,.3,.15,.025,mat(colors[status]),false);
        }
      }
      [-2,2].forEach(x=>{const b=addBox(rack,x,.95,.12,.08,1.5,.08,mat(0x4c91bd));b.rotation.z=x<0?-.42:.42;});
      rack.traverse(o=>{if(o.isMesh)o.userData.rackRef=rack;});
      scene.add(rack); racks.push(rack); idx++;
    }

    for(let i=0;i<7;i++) {
      const x=-9+(i%4)*5.5,z=8.2+Math.floor(i/4)*1.1;
      addBox(scene,x,.13,z,1.3,.24,.95,pallet);
      addBox(scene,x,.52,z,.95,.55,.75,cartons[i%cartons.length]);
    }
    const truck=new THREE.Group(); truck.position.set(8.2,0,7);
    addBox(truck,0,.5,0,1.35,.72,1,mat(0xffb329));
    addBox(truck,-.12,1.12,-.08,.8,.58,.8,mat(0x234c70));
    addBox(truck,.78,.95,-.1,.12,1.55,.14,dark);
    addBox(truck,1.02,.17,.05,1,.09,.14,mat(0x313f50));
    [-.45,.45].forEach(x=>[-.38,.38].forEach(z=>{
      const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.23,.23,.15,18),mat(0x263a4e));
      wheel.rotation.z=Math.PI/2;wheel.position.set(x,.24,z);truck.add(wheel);
    }));
    scene.add(truck);

    // Built-in mouse/touch orbit: no OrbitControls import and no import-map dependency.
    const target=new THREE.Vector3(0,1.15,0);
    let radius=23, azimuth=Math.atan2(19,22);
    let polar=Math.acos(16/Math.sqrt(19*19+16*16+22*22));
    let dragging=false,moved=false,lastX=0,lastY=0,startX=0,startY=0;
    function updateCamera() {
      polar=THREE.MathUtils.clamp(polar,.22,1.42);
      radius=THREE.MathUtils.clamp(radius,13,48);
      camera.position.set(target.x+radius*Math.sin(polar)*Math.sin(azimuth),target.y+radius*Math.cos(polar),target.z+radius*Math.sin(polar)*Math.cos(azimuth));
      camera.lookAt(target);
    }
    updateCamera();
    const canvas=renderer.domElement;
    canvas.addEventListener("pointerdown",e=>{dragging=true;moved=false;lastX=startX=e.clientX;lastY=startY=e.clientY;canvas.setPointerCapture?.(e.pointerId);canvas.style.cursor="grabbing";});
    canvas.addEventListener("pointermove",e=>{
      if(!dragging)return;
      const dx=e.clientX-lastX,dy=e.clientY-lastY;
      if(Math.abs(e.clientX-startX)+Math.abs(e.clientY-startY)>5)moved=true;
      azimuth-=dx*.008;polar-=dy*.006;lastX=e.clientX;lastY=e.clientY;updateCamera();
    });
    const stop=()=>{dragging=false;canvas.style.cursor="grab";};
    canvas.addEventListener("pointerup",stop);canvas.addEventListener("pointercancel",stop);
    canvas.addEventListener("wheel",e=>{e.preventDefault();radius*=e.deltaY>0?1.08:.92;updateCamera();},{passive:false});

    const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2();
    // const modalEl=$("rackModal");
    // const modal=window.bootstrap&&modalEl?new window.bootstrap.Modal(modalEl):null;
    canvas.addEventListener("click",e=>{
      if(moved)return;
      const r=canvas.getBoundingClientRect();
      pointer.x=((e.clientX-r.left)/r.width)*2-1;
      pointer.y=-((e.clientY-r.top)/r.height)*2+1;
      raycaster.setFromCamera(pointer,camera);
      const hits=raycaster.intersectObjects(racks,true);
      if(!hits.length)return;
      let obj=hits[0].object;
      while(obj&&!obj.userData.rackRef&&!obj.userData.rackName)obj=obj.parent;
      const selected=obj?.userData.rackRef||obj;
      if(selected?.userData?.rackName) {
        showRack(selected, true);
      }
    
    });

    function showRack(rack, openModal = false) {

      const data = rack.userData.inventory;

      if (!data) {
        console.error("Missing inventory data", rack.userData);
        return;
      }

      const statusText = {
        healthy: "Healthy",
        low: "Low Stock",
        critical: "Critical"
      };

      const statusColor = {
        healthy: "#16bd83",
        low: "#ff9e24",
        critical: "#f04462"
      };

      const color = statusColor[data.status];

      // Update persistent information panel
      infoPanel.innerHTML = `
        <div style="font-size:10px;font-weight:800;
                    letter-spacing:1.2px;color:#7891aa">
          SELECTED LOCATION
        </div>

        <div style="display:flex;justify-content:space-between;
                    align-items:center;margin-top:7px">
          <strong style="font-size:23px;color:#123c70">
            ${data.id}
          </strong>

          <span style="background:${color}18;color:${color};
                      padding:5px 10px;border-radius:20px;
                      font-size:10px;font-weight:800">
            ${statusText[data.status]}
          </span>
        </div>

        <div style="height:1px;background:#e7eef5;margin:13px 0"></div>

        <div style="font-size:10px;color:#8195aa">MATERIAL</div>
        <div style="font-size:14px;font-weight:800;margin-top:3px">
          ${data.material}
        </div>

        <div style="font-size:10px;color:#8195aa;margin-top:12px">
          TOTAL QUANTITY
        </div>
        <div style="font-size:25px;font-weight:900;color:#164b85">
          ${data.qty.toLocaleString()}
          <span style="font-size:12px">${data.unit}</span>
        </div>

        <div style="display:flex;justify-content:space-between;
                    margin-top:14px;font-size:11px">
          <strong>Storage Capacity</strong>
          <strong>${data.capacity}%</strong>
        </div>

        <div style="height:7px;background:#e8eef5;
                    border-radius:20px;overflow:hidden;margin-top:7px">
          <div style="width:${data.capacity}%;height:100%;
                      background:${color};border-radius:20px">
          </div>
        </div>

        <div style="font-size:10px;font-weight:800;
                    letter-spacing:.8px;color:#7891aa;margin-top:16px">
          INVENTORY BY LEVEL
        </div>

        ${data.levels.map(item => `
          <div style="display:flex;justify-content:space-between;
                      padding:9px 0;border-bottom:1px solid #edf1f5;
                      font-size:11px;gap:8px">
            <span>${item.level}</span>
            <strong>${item.qty.toLocaleString()} ${item.unit}</strong>
          </div>
        `).join("")}
      `;

      // Update existing modal fields too
      const put = (id, value) => {
        if ($(id)) $(id).textContent = value;
      };

      put("modalRackTitle", "Rack " + data.id);
      put("modalStatus", statusText[data.status]);
      put("modalMaterial", data.material);
      put("modalQty", data.qty.toLocaleString() + " " + data.unit);
      put("modalCapacity", data.capacity + "%");

      if ($("modalStatus")) {
        $("modalStatus").style.color = color;
      }

      if ($("capacityBar")) {
        $("capacityBar").style.width = data.capacity + "%";
        $("capacityBar").style.background = color;
      }

      if (openModal && modal) {
        modal.show();
      }
    }

    if (racks.length > 0) {
      showRack(racks[0], false);
    }
    $("zoomIn")?.addEventListener("click",()=>{radius*=.86;updateCamera();});
    $("zoomOut")?.addEventListener("click",()=>{radius*=1.16;updateCamera();});
    $("resetView")?.addEventListener("click",()=>{radius=30;azimuth=Math.atan2(19,22);polar=Math.acos(16/Math.sqrt(19*19+16*16+22*22));updateCamera();});

    function resize() {
      const w=Math.max(host.clientWidth,320),h=Math.max(host.clientHeight,240);
      camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);
    }
    window.addEventListener("resize",resize);
    if(window.ResizeObserver)new ResizeObserver(resize).observe(host);
    function animate(){requestAnimationFrame(animate);renderer.render(scene,camera);}
    animate();
    console.info(`[Inventory 3D] Initialized successfully: ${racks.length} racks.`);
  } catch(err) {
    fail(err?.message||"Unknown JavaScript or WebGL error.",err);
  }
})();
