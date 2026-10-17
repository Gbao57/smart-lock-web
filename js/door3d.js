let scene, camera, renderer, doorGroup;
let isDoor3DOpen = false;

window.addEventListener('load', () => {
  init3DScene();
});

function init3DScene() {
  const canvas = document.getElementById('doorCanvas');
  if (!canvas) return;

  const width = canvas.clientWidth || 300;
  const height = canvas.clientHeight || 190;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f172a);

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(0, 0, 8);

  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);

  // Ánh sáng
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);

  // Khung cửa
  const frameGeo = new THREE.BoxGeometry(3.2, 5.2, 0.2);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
  const frame = new THREE.Mesh(frameGeo, frameMat);
  scene.add(frame);

  // Nhóm Cánh cửa (Xoay quanh lề trái)
  doorGroup = new THREE.Group();
  doorGroup.position.set(-1.4, 0, 0);

  const doorGeo = new THREE.BoxGeometry(2.8, 4.8, 0.15);
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, metalness: 0.2, roughness: 0.5 });
  const doorMesh = new THREE.Mesh(doorGeo, doorMat);
  doorMesh.position.set(1.4, 0, 0);
  doorGroup.add(doorMesh);

  // Tay cầm cửa
  const handleGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 16);
  const handleMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8, roughness: 0.2 });
  const handle = new THREE.Mesh(handleGeo, handleMat);
  handle.position.set(2.4, 0, 0.15);
  doorGroup.add(handle);

  scene.add(doorGroup);

  animate3D();
}

function animate3D() {
  requestAnimationFrame(animate3D);

  if (doorGroup) {
    const targetAngle = isDoor3DOpen ? -Math.PI / 2.5 : 0;
    doorGroup.rotation.y += (targetAngle - doorGroup.rotation.y) * 0.1;
  }

  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

function update3DDoorState(locked) {
  isDoor3DOpen = !locked;
}

window.addEventListener('resize', () => {
  const canvas = document.getElementById('doorCanvas');
  if (!canvas || !renderer || !camera) return;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
});