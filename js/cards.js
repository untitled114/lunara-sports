const cardsData = [
  {title:"Built for You", desc:"High-quality solutions without the corporate markup. Designed with care."},
  {title:"Reliability Matters", desc:"Every detail is intentional. Consistent performance."},
  {title:"Affordable Vision", desc:"Cheaper than 95% of the market — innovation is accessible."},
  {title:"Seamless Experience", desc:"From idea to reality, enjoy a clean and intuitive flow."}
];

const cardsContainer = document.querySelector('.cards-container');

if (cardsContainer) {
  cardsData.forEach((data,index)=>{
    const card = document.createElement('div');
    card.className = 'card';
    card.style.transitionDelay = `${index*0.2}s`; // staggered fade-in
    card.innerHTML = `<h3>${data.title}</h3><p>${data.desc}</p>`;
    cardsContainer.appendChild(card);
  });
}

const observer = new IntersectionObserver(entries=>{
  entries.forEach(entry=>{
    if(entry.isIntersecting){
      entry.target.style.opacity=1;
      entry.target.style.transform='translateY(0)';
    }
  });
},{ threshold:0.2 });

document.querySelectorAll('.card').forEach(card=>observer.observe(card));


