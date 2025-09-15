let scene, camera, renderer, particles;

function initParticles() {
    const canvas = document.getElementById('particles');
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({canvas:canvas, alpha:true});
    renderer.setSize(window.innerWidth, window.innerHeight);

    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    for(let i=0;i<3000;i++){
        vertices.push(Math.random()*2000-1000, Math.random()*2000-1000, Math.random()*2000-1000);
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices,3));

    const material = new THREE.PointsMaterial({color:0x6366f1, size:2, transparent:true, opacity:0.6});
    particles = new THREE.Points(geometry, material);
    scene.add(particles);
    camera.position.z = 1000;
}
function animate(){
    requestAnimationFrame(animate);
    particles.rotation.x += 0.0005;
    particles.rotation.y += 0.001;
    renderer.render(scene,camera);
}
window.addEventListener('resize', ()=>{
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
initParticles();
animate();

// Navigation
function showSection(sectionName){
    document.querySelectorAll('.content-section').forEach(s=>s.style.display='none');
    document.getElementById(sectionName).style.display='block';
    document.querySelectorAll('.sidebar-link').forEach(l=>l.classList.remove('active'));
    event.target.classList.add('active');
}

// Collapsible
function toggleCollapsible(button){
    const content = button.nextElementSibling;
    const arrow = button.querySelector('span:last-child');
    if(content.classList.contains('active')){
        content.classList.remove('active');
        if(arrow) arrow.style.transform='rotate(0deg)';
    }else{
        content.classList.add('active');
        if(arrow) arrow.style.transform='rotate(180deg)';
    }
}
