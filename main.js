// === Инициализация сцены, камеры, рендерера ===
const scene    = new THREE.Scene();
const camera   = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// === Освещение и день/ночь ===
const hemiLight = new THREE.HemisphereLight(0xffffee, 0x080820, 0.5);
scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(10,20,10);
dirLight.castShadow = true;
scene.add(dirLight);

let timeOfDay = 0;
function updateDayNight(delta) {
  timeOfDay = (timeOfDay + delta*0.5) % 24;
  const t = Math.cos((timeOfDay/24)*Math.PI*2) * 0.5 + 0.5;
  hemiLight.intensity = 0.5 + 0.5*t;
  dirLight.intensity = 0.2 + 0.8*t;
  scene.background = new THREE.Color( t*0.4 + 0.1, t*0.5 + 0.1, t*0.7 + 0.2 );
}

// === Земля ===
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(1000,1000),
  new THREE.MeshStandardMaterial({ color: 0x228B22 })
);
ground.rotation.x = -Math.PI/2;
ground.receiveShadow = true;
scene.add(ground);

// === Игрок ===
const player = new THREE.Mesh(
  new THREE.BoxGeometry(1,2,1),
  new THREE.MeshStandardMaterial({ color: 0x0000ff })
);
player.castShadow = true;
player.position.y = 1;
scene.add(player);

// === Камера ===
camera.position.set(0,5,10);
camera.lookAt(player.position);

// === Контроль движения ===
const keys = {};
window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup',   e => keys[e.key.toLowerCase()] = false);

// === UI ссылки ===
const dialog       = document.getElementById('dialog');
const professionUI = document.getElementById('profession');
const missionUI    = document.getElementById('mission');
const invList      = document.getElementById('inv-list');
const shopUI       = document.getElementById('shop');
const shopItemsDiv = document.getElementById('shop-items');
const closeShopBtn = document.getElementById('close-shop');
const moneyUI      = document.getElementById('money');

// === Инвентарь и деньги ===
let inventory = [];
let money = 1000;
function updateInventory() {
  invList.innerHTML = '';
  inventory.forEach(i=>{
    const li = document.createElement('li');
    li.textContent = i;
    invList.appendChild(li);
  });
}
moneyUI.textContent = `Деньги: ${money}₽`;

// === Профессии и миссии ===
const professions = ['Гражданин','Продавец','Путешественник','Полицейский'];
let   currentProfession = professions[0];
professionUI.textContent = 'Профессия: ' + currentProfession;

let activeMission = null;
function updateMissionUI() {
  missionUI.textContent = 'Задание: ' + (activeMission ? activeMission.desc : 'нет');
}
updateMissionUI();

// === Магазин ===
const shopItems = ['Вода - 1₽','Еда - 2₽','Телефон - 100₽'];
function openShop() {
  shopUI.style.display = 'block';
  shopItemsDiv.innerHTML = '';
  shopItems.forEach(it=>{
    const btn = document.createElement('button');
    const [item, price] = it.split(' - ');
    btn.textContent = it;
    btn.onclick = ()=>{
      const cost = parseInt(price);
      if (money >= cost) {
        inventory.push(item);
        money -= cost;
        updateInventory();
        moneyUI.textContent = `Деньги: ${money}₽`;
      } else {
        dialog.classList.remove('hidden');
        dialog.textContent = 'Недостаточно денег!';
        setTimeout(()=>dialog.classList.add('hidden'), 2000);
      }
    };
    shopItemsDiv.appendChild(btn);
  });
}
closeShopBtn.onclick = ()=> shopUI.style.display = 'none';

// === NPC ===
const npcList = [];
function createNPC(x,z,role,color) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5,0.5,2),
    new THREE.MeshStandardMaterial({ color })
  );
  mesh.position.set(x,1,z);
  mesh.castShadow = true;
  scene.add(mesh);
  npcList.push({ mesh, role });
}
createNPC(5,5,'Shopkeeper', 0xffa500);
createNPC(-5,5,'MissionGiver',0x00ff00);
createNPC(5,-5,'Employer',   0x0000ff);

// === Телепорт ===
window.teleport = (x,z)=>{
  player.position.set(x,1,z);
  camera.position.set(x,5,z+10);
  camera.lookAt(player.position);
  dialog.innerText = `Телепортирован в [${x},${z}]`;
  setTimeout(()=>dialog.classList.add('hidden'), 2000);
};

// === Генерация сюжета через ChatGPT ===
async function getStory(action) {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':'Bearer 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'
      },
      body: JSON.stringify({
        model:'gpt-4',
        messages:[{role:'user', content:`Сюжет для действия: ${action}`}]
      })
    });
    const d = await res.json();
    return d.choices?.[0]?.message?.content || 'Нет ответа от AI.';
  } catch {
    return 'Ошибка подключения к AI';
  }
}

// === Взаимодействие с NPC и события ===
window.addEventListener('keydown', async e=>{
  if (e.key.toLowerCase() === 'e') {
    let nearest = null, minD = Infinity;
    npcList.forEach(n=>{
      const d = n.mesh.position.distanceTo(player.position);
      if (d<minD){ minD=d; nearest=n; }
    });
    if (nearest && minD<3) {
      dialog.classList.remove('hidden');
      if (nearest.role==='Shopkeeper') {
        dialog.innerText = 'Магазин открыт';
        openShop();
      }
      if (nearest.role==='MissionGiver') {
        activeMission = { desc:'Дойти до (20,20)', target:new THREE.Vector3(20,0,20) };
        updateMissionUI();
        dialog.innerText = await getStory('Получил новое задание');
      }
      if (nearest.role==='Employer') {
        currentProfession = professions[Math.floor(Math.random()*professions.length)];
        professionUI.textContent = 'Профессия: '+currentProfession;
        dialog.innerText = await getStory(`Стал ${currentProfession}`);
      }
      setTimeout(()=>dialog.classList.add('hidden'), 4000);
    }
  }
});

// === Анимация и игровой цикл ===
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  // День/ночь
  updateDayNight(delta);

  // Движение
  const speed = activeMission && keys['shift'] ? 0.3 : 0.1;
  if (keys['w']) player.position.z -= speed;
  if (keys['s']) player.position.z += speed;
  if (keys['a']) player.position.x -= speed;
  if (keys['d']) player.position.x += speed;

  // Проверка окончания миссии
  if (activeMission) {
    const d = player.position.distanceTo(activeMission.target);
    if (d < 2) {
      dialog.classList.remove('hidden');
      dialog.innerText = 'Задание выполнено!';
      activeMission = null;
      updateMissionUI();
      setTimeout(()=>dialog.classList.add('hidden'), 3000);
    }
  }

  // Камера
  camera.position.lerp(new THREE.Vector3(
    player.position.x,
    player.position.y+5,
    player.position.z+10
  ), 0.1);
  camera.lookAt(player.position);

  renderer.render(scene, camera);
}
animate();

// === Подстройка при ресайзе ===
window.addEventListener('resize', ()=>{
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
