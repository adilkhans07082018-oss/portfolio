/**
 * MOHD AADIL - PORTFOLIO INTERACTIVITY SCRIPT
 * Web Developer & Graphic Designer
 */

document.addEventListener('DOMContentLoaded', () => {
  initThemeToggle();
  initTypewriter();
  initMobileNav();
  initCounterStats();
  initPortfolioFilter();
  initProjectModal();
  initResumeModal();
  initContactForm();
  initScrollSpy();
  initBackToTop();
  initCopyButtons();
});

/* -------------------------------------------------------------
 * 1. THEME TOGGLE (DARK / LIGHT MODE)
 * ------------------------------------------------------------- */
function initThemeToggle() {
  const toggleBtn = document.getElementById('theme-toggle');
  const toggleIcon = document.getElementById('theme-toggle-icon');
  
  // Check persisted preference or default to dark
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      updateThemeIcon(newTheme);
      showToast(`Switched to ${newTheme === 'dark' ? 'Dark' : 'Light'} Mode`, 'info');
    });
  }

  function updateThemeIcon(theme) {
    if (!toggleIcon) return;
    if (theme === 'light') {
      toggleIcon.className = 'fa-solid fa-moon text-indigo-600 text-lg';
    } else {
      toggleIcon.className = 'fa-solid fa-sun text-yellow-400 text-lg';
    }
  }
}

/* -------------------------------------------------------------
 * 2. DYNAMIC TYPEWRITER EFFECT
 * ------------------------------------------------------------- */
function initTypewriter() {
  const typewriterEl = document.getElementById('typewriter-text');
  if (!typewriterEl) return;

  const roles = [
    'Web Developer',
    'WordPress & CMS Specialist',
    'Graphic & UI/UX Designer',
    'Shopify Store Creator',
    'Digital Marketer & Photographer',
    'AI-Enhanced Solution Builder'
  ];

  let roleIndex = 0;
  let charIndex = 0;
  let isDeleting = false;
  let typingDelay = 100;

  function type() {
    const currentRole = roles[roleIndex];

    if (isDeleting) {
      typewriterEl.textContent = currentRole.substring(0, charIndex - 1);
      charIndex--;
      typingDelay = 50;
    } else {
      typewriterEl.textContent = currentRole.substring(0, charIndex + 1);
      charIndex++;
      typingDelay = 110;
    }

    if (!isDeleting && charIndex === currentRole.length) {
      isDeleting = true;
      typingDelay = 1800; // Pause at end of word
    } else if (isDeleting && charIndex === 0) {
      isDeleting = false;
      roleIndex = (roleIndex + 1) % roles.length;
      typingDelay = 400; // Pause before typing new word
    }

    setTimeout(type, typingDelay);
  }

  type();
}

/* -------------------------------------------------------------
 * 3. MOBILE NAVIGATION DRAWER
 * ------------------------------------------------------------- */
function initMobileNav() {
  const menuToggle = document.getElementById('mobile-menu-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  const closeMenu = document.getElementById('mobile-menu-close');
  const navLinks = document.querySelectorAll('.mobile-nav-link');

  if (!menuToggle || !mobileMenu) return;

  function openDrawer() {
    mobileMenu.classList.remove('hidden');
    setTimeout(() => {
      mobileMenu.classList.remove('opacity-0', 'pointer-events-none');
    }, 10);
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    mobileMenu.classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => {
      mobileMenu.classList.add('hidden');
    }, 300);
    document.body.style.overflow = 'auto';
  }

  menuToggle.addEventListener('click', openDrawer);
  if (closeMenu) closeMenu.addEventListener('click', closeDrawer);

  navLinks.forEach(link => {
    link.addEventListener('click', closeDrawer);
  });
}

/* -------------------------------------------------------------
 * 4. ANIMATED STATS COUNTER
 * ------------------------------------------------------------- */
function initCounterStats() {
  const counters = document.querySelectorAll('.counter-value');
  let hasAnimated = false;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !hasAnimated) {
        hasAnimated = true;
        counters.forEach(counter => {
          const target = +counter.getAttribute('data-target');
          let count = 0;
          const speed = target > 50 ? 25 : 40;
          const increment = Math.ceil(target / (1000 / speed));

          const updateCount = () => {
            count += increment;
            if (count < target) {
              counter.innerText = count;
              setTimeout(updateCount, speed);
            } else {
              counter.innerText = target;
            }
          };
          updateCount();
        });
      }
    });
  }, { threshold: 0.5 });

  const statsSection = document.getElementById('stats-strip');
  if (statsSection) {
    observer.observe(statsSection);
  }
}

/* -------------------------------------------------------------
 * 5. PORTFOLIO FILTER
 * ------------------------------------------------------------- */
function initPortfolioFilter() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  const projectCards = document.querySelectorAll('.project-card');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Toggle active class
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filterValue = btn.getAttribute('data-filter');

      projectCards.forEach(card => {
        const category = card.getAttribute('data-category');
        if (filterValue === 'all' || category.includes(filterValue)) {
          card.style.display = 'block';
          setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'scale(1)';
          }, 10);
        } else {
          card.style.opacity = '0';
          card.style.transform = 'scale(0.95)';
          setTimeout(() => {
            card.style.display = 'none';
          }, 250);
        }
      });
    });
  });
}

/* -------------------------------------------------------------
 * 6. PROJECT DETAILS MODAL
 * ------------------------------------------------------------- */
const projectDatabase = {
  'paul-walter': {
    title: 'Paul Walter Luxury Atelier & Brand Store',
    category: 'Web Development & E-Commerce',
    client: 'Paul Walter',
    year: '2023 - 2024',
    badge: 'Featured Project',
    image: 'assets/images/paul-walter.svg',
    summary: 'A bespoke, high-fashion e-commerce portal and lifestyle brand showcase engineered for timeless presentation, rapid page loads, and seamless checkout journeys.',
    features: [
      'Custom WordPress & WooCommerce theme architecture with bespoke typography',
      'High-resolution imagery optimization with WebP lazy-loading for sub-second speeds',
      'Dynamic product filtering, size matrix picker, and real-time inventory preview',
      'Mobile-first responsive architecture designed for luxury international shoppers',
      'Integrated SSL security, CDN setup, and SEO-optimized metadata structure'
    ],
    tech: ['WordPress Core', 'WooCommerce', 'PHP / HTML5', 'Custom CSS', 'SEO Optimization', 'Speed Tuning']
  },
  'wash-basins': {
    title: 'The Wash Basins Company Catalog & E-Commerce',
    category: 'E-Commerce & Sanitaryware Catalog',
    client: 'The Wash Basins Company',
    year: '2023',
    badge: 'E-Commerce Showcase',
    image: 'assets/images/wash-basins.svg',
    summary: 'Architectural sanitaryware showcase and distributor portal created to exhibit luxury countertop, freestanding, and artisan stone basins with interactive specification sheets.',
    features: [
      'Engineered structured product catalog with multi-attribute filtering (Stone, Ceramic, Freestanding)',
      'Wholesale inquiry & instant quotation request system',
      'High-impact modern visual hierarchy tailored to architects, interior designers & homeowners',
      'Responsive gallery with 360-degree viewing mockups and specification PDF downloads',
      'Managed domain, DNS, SSL hosting environment, and cPanel configuration'
    ],
    tech: ['WordPress', 'Elementor Pro', 'WooCommerce', 'Custom Post Types', 'cPanel & Hosting', 'SSL Setup']
  },
  'indus-connections': {
    title: 'Indus Connections Digital Ecosystem & Media Suite',
    category: 'Corporate Web, Digital Marketing & Photography',
    client: 'Indus Connections',
    year: '2022 - Present',
    badge: 'Agency Work (Active)',
    image: 'assets/images/indus-connections.svg',
    summary: 'Comprehensive brand management, web platform development, digital marketing campaigns, and commercial photography for high-growth enterprise initiatives.',
    features: [
      'Designed and administered company websites with modern layouts and fast caching',
      'Produced complete graphic design assets including company brochures, logos, and promotional creatives',
      'Spearheaded digital marketing campaigns with social media management, email blasts, and SEO basics',
      'Conducted on-site commercial photography for corporate branding, executive portraits, and products',
      'Maintained 99.9% web uptime and performed hardware/network remote technical troubleshooting'
    ],
    tech: ['WordPress', 'Adobe Photoshop', 'Illustrator', 'Lightroom', 'Digital Marketing', 'Network/IT Support']
  },
  'reddash-media': {
    title: 'Red Dash Media Campaign & Creative Assets',
    category: 'Graphic Design & Digital Advertising',
    client: 'Red Dash Media Clients',
    year: '2021',
    badge: 'Creative Agency',
    image: 'assets/images/reddash-media.svg',
    summary: 'Spearheaded digital advertising creatives, social media marketing kits, and client website development support for diverse commercial sectors.',
    features: [
      'Developed eye-catching promotional banners, posters, and social media carousels',
      'Assisted in front-end website layout adjustments, CSS modifications, and CMS updates',
      'Coordinated brand promotion workflows across Instagram, Facebook, and LinkedIn',
      'Collaborated directly with creative directors to ensure strict brand compliance'
    ],
    tech: ['Photoshop', 'CorelDraw', 'Illustrator', 'Social Media Strategy', 'HTML & CSS Support']
  },
  'pizeonfly': {
    title: 'Pizeonfly Client Web Portals & CMS Deployments',
    category: 'WordPress Development & Theme Customization',
    client: 'Pizeonfly Multiple Clients',
    year: '2018 - 2020',
    badge: '2 Years Dedicated',
    image: 'assets/images/pizeonfly.svg',
    summary: 'Engineered, customized, and maintained over 30+ responsive WordPress websites, email newsletters, and client marketing materials over a 2-year tenure.',
    features: [
      'Developed custom themes, child themes, and interactive page templates with WordPress builders',
      'Designed responsive email newsletters, banner campaigns, and promotional collateral',
      'Coordinated directly with clients to translate business requirements into digital solutions',
      'Implemented cross-browser testing and mobile responsiveness standards'
    ],
    tech: ['WordPress Builders (Elementor, Divi)', 'HTML5 & CSS3', 'Email Marketing', 'Client Management']
  },
  'photography-suite': {
    title: 'Commercial Product & Portrait Photography Studio',
    category: 'Portrait & Commercial Photography',
    client: 'Commercial & Private Clients',
    year: 'Ongoing Passion',
    badge: 'Creative Speciality',
    image: 'assets/images/photography.svg',
    summary: 'High-end commercial product photography and portraiture crafted for brand campaigns, corporate leadership, e-commerce stores, and editorial publications.',
    features: [
      'Studio and outdoor lighting setups tailored to product depth and human emotion',
      'Advanced post-processing with Adobe Lightroom and Photoshop frequency separation',
      'Color-accurate grading for digital catalogs and physical high-resolution print brochures',
      'Seamless integration into web design layouts to maximize visual storytelling'
    ],
    tech: ['Prime Lens Optics', 'Adobe Lightroom', 'Photoshop Retouching', 'Lighting & Composition']
  }
};

function initProjectModal() {
  const modal = document.getElementById('project-modal');
  const modalClose = document.getElementById('project-modal-close');
  const projectButtons = document.querySelectorAll('.open-project-btn');

  if (!modal) return;

  function openModal(projectId) {
    const data = projectDatabase[projectId];
    if (!data) return;

    document.getElementById('modal-title').textContent = data.title;
    document.getElementById('modal-category').textContent = data.category;
    document.getElementById('modal-badge').textContent = data.badge;
    document.getElementById('modal-image').src = data.image;
    document.getElementById('modal-image').alt = data.title;
    document.getElementById('modal-summary').textContent = data.summary;
    document.getElementById('modal-client').textContent = data.client;
    document.getElementById('modal-year').textContent = data.year;

    // Populate Key Features
    const featureList = document.getElementById('modal-features');
    featureList.innerHTML = '';
    data.features.forEach(feat => {
      const li = document.createElement('li');
      li.className = 'flex items-start gap-2.5 text-sm text-slate-300';
      li.innerHTML = `<i class="fa-solid fa-circle-check text-indigo-400 mt-1 flex-shrink-0"></i> <span>${feat}</span>`;
      featureList.appendChild(li);
    });

    // Populate Tech Stack Tags
    const techContainer = document.getElementById('modal-tech');
    techContainer.innerHTML = '';
    data.tech.forEach(t => {
      const span = document.createElement('span');
      span.className = 'badge-pill text-xs';
      span.textContent = t;
      techContainer.appendChild(span);
    });

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
  }

  projectButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const projectId = btn.getAttribute('data-project');
      openModal(projectId);
    });
  });

  if (modalClose) modalClose.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });
}

/* -------------------------------------------------------------
 * 7. RESUME MODAL & PRINT HANDLER
 * ------------------------------------------------------------- */
function initResumeModal() {
  const resumeModal = document.getElementById('resume-modal');
  const openBtns = document.querySelectorAll('.open-resume-btn');
  const closeBtn = document.getElementById('resume-modal-close');
  const printBtn = document.getElementById('print-resume-btn');

  if (!resumeModal) return;

  function openResume() {
    resumeModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeResume() {
    resumeModal.classList.remove('active');
    document.body.style.overflow = 'auto';
  }

  openBtns.forEach(btn => btn.addEventListener('click', openResume));
  if (closeBtn) closeBtn.addEventListener('click', closeResume);

  resumeModal.addEventListener('click', (e) => {
    if (e.target === resumeModal) closeResume();
  });

  if (printBtn) {
    printBtn.addEventListener('click', () => {
      window.print();
    });
  }
}

/* -------------------------------------------------------------
 * 8. INTERACTIVE CONTACT FORM WITH DIRECT CONNECT
 * ------------------------------------------------------------- */
function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('sender-name')?.value.trim();
    const email = document.getElementById('sender-email')?.value.trim();
    const subject = document.getElementById('sender-subject')?.value.trim() || 'New Portfolio Project Inquiry';
    const message = document.getElementById('sender-message')?.value.trim();

    if (!name || !email || !message) {
      showToast('Please fill out all required fields.', 'error');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Sending...';
    submitBtn.disabled = true;

    setTimeout(() => {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
      showToast(`Thank you, ${name}! Your message is prepared.`, 'success');

      // Compose mailto link to Mohd Aadil's official email
      const mailtoUrl = `mailto:adilkhans07082018@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
        `Hi Mohd Aadil,\n\nName: ${name}\nEmail: ${email}\n\nMessage:\n${message}\n\nSent from Portfolio Website`
      )}`;

      window.location.href = mailtoUrl;
      form.reset();
    }, 800);
  });
}

/* -------------------------------------------------------------
 * 9. SCROLL SPY FOR ACTIVE NAV LINKS
 * ------------------------------------------------------------- */
function initScrollSpy() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.desktop-nav-link');

  window.addEventListener('scroll', () => {
    let currentId = '';
    const scrollPosition = window.pageYOffset + 120;

    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
        currentId = section.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('text-indigo-400', 'font-semibold');
      if (link.getAttribute('href') === `#${currentId}`) {
        link.classList.add('text-indigo-400', 'font-semibold');
      }
    });
  });
}

/* -------------------------------------------------------------
 * 10. BACK TO TOP BUTTON
 * ------------------------------------------------------------- */
function initBackToTop() {
  const bttBtn = document.getElementById('back-to-top');
  if (!bttBtn) return;

  window.addEventListener('scroll', () => {
    if (window.pageYOffset > 400) {
      bttBtn.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-4');
      bttBtn.classList.add('opacity-100', 'pointer-events-auto', 'translate-y-0');
    } else {
      bttBtn.classList.add('opacity-0', 'pointer-events-none', 'translate-y-4');
      bttBtn.classList.remove('opacity-100', 'pointer-events-auto', 'translate-y-0');
    }
  });

  bttBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* -------------------------------------------------------------
 * 11. QUICK COPY TO CLIPBOARD BUTTONS
 * ------------------------------------------------------------- */
function initCopyButtons() {
  const copyEmailBtn = document.getElementById('copy-email-btn');
  const copyPhoneBtn = document.getElementById('copy-phone-btn');

  if (copyEmailBtn) {
    copyEmailBtn.addEventListener('click', () => {
      navigator.clipboard.writeText('adilkhans07082018@gmail.com').then(() => {
        showToast('Email address copied to clipboard!', 'success');
      });
    });
  }

  if (copyPhoneBtn) {
    copyPhoneBtn.addEventListener('click', () => {
      navigator.clipboard.writeText('+91 7217627771').then(() => {
        showToast('Phone number copied to clipboard!', 'success');
      });
    });
  }
}

/* -------------------------------------------------------------
 * 12. TOAST NOTIFICATION UTILITY
 * ------------------------------------------------------------- */
function showToast(message, type = 'info') {
  let toast = document.getElementById('toast-notification');
  let toastMsg = document.getElementById('toast-message');
  let toastIcon = document.getElementById('toast-icon');

  if (!toast) return;

  toastMsg.textContent = message;

  if (type === 'success') {
    toastIcon.className = 'fa-solid fa-circle-check text-emerald-400 text-lg';
  } else if (type === 'error') {
    toastIcon.className = 'fa-solid fa-circle-exclamation text-rose-400 text-lg';
  } else {
    toastIcon.className = 'fa-solid fa-circle-info text-indigo-400 text-lg';
  }

  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3800);
}
