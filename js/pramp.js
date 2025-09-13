const faders = document.querySelectorAll('.fade-in');
const appearOptions = { threshold: 0.2 };

const appearOnScroll = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => {
    if(entry.isIntersecting){
      entry.target.classList.add('visible');
      // Particle speed ramp
      let ramp = 0.005; // base rotation speed
      let duration = 1000; // 1 sec
      let start = Date.now();
      const rampParticles = () => {
        let elapsed = Date.now() - start;
        if(elapsed < duration){
          particles.rotation.y += ramp * (1 - elapsed/duration) + 0.001;
          particles.rotation.x += ramp * (1 - elapsed/duration) + 0.0005;
          requestAnimationFrame(rampParticles);
        }
      }
      rampParticles();
      observer.unobserve(entry.target);
    }
  });
}, appearOptions);

faders.forEach(fader => appearOnScroll.observe(fader));
