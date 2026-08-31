const THEME_STORAGE_KEY = 'animosort_theme';

function readThemePreference() {
  try {
    const value = globalThis.localStorage?.getItem(THEME_STORAGE_KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch (error) {
    return null;
  }
}

function saveThemePreference(theme) {
  try {
    globalThis.localStorage?.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    return false;
  }
  return true;
}

function systemPrefersDark() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function updateThemeToggle(theme) {
  const toggle = document.getElementById('theme-toggle');
  const label = document.getElementById('theme-toggle-text');
  const isDark = theme === 'dark' || (!theme && systemPrefersDark());
  if (label) label.textContent = isDark ? 'Light' : 'Dark';
  if (toggle) {
    const nextLabel = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    toggle.setAttribute('aria-label', nextLabel);
    toggle.setAttribute('title', nextLabel);
  }
}

function notifyThemeChange(theme) {
  if (typeof window.CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent('animosort:theme-change', { detail: { theme } }));
  }
}

function initTheme() {
  const savedTheme = readThemePreference();
  if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeToggle(savedTheme);

  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const activeTheme = document.documentElement.getAttribute('data-theme');
      const currentlyDark = activeTheme ? activeTheme === 'dark' : systemPrefersDark();
      const nextTheme = currentlyDark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', nextTheme);
      saveThemePreference(nextTheme);
      updateThemeToggle(nextTheme);
      notifyThemeChange(nextTheme);
    });
  }

  if (typeof window.matchMedia === 'function') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event) => {
      if (!readThemePreference()) {
        updateThemeToggle(event.matches ? 'dark' : 'light');
        notifyThemeChange(event.matches ? 'dark' : 'light');
      }
    };
    if (typeof mediaQuery.addEventListener === 'function') mediaQuery.addEventListener('change', handleChange);
    else if (typeof mediaQuery.addListener === 'function') mediaQuery.addListener(handleChange);
  }
}

function initNavigation() {
  const nav = document.getElementById('mainNav');
  if (!nav) return;
  const update = () => nav.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', update, { passive: true });
  update();
}

function initSmoothScroll() {
  const getScrollBehavior = () => (
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  );
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const href = link.getAttribute('href');
      if (href === '#') {
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: getScrollBehavior() });
        return;
      }
      const target = href ? document.querySelector(href) : null;
      if (target) {
        event.preventDefault();
        target.scrollIntoView({ behavior: getScrollBehavior() });
      }
    });
  });
}

function initReveal() {
  const revealElements = document.querySelectorAll('.reveal');
  const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!('IntersectionObserver' in window) || reducedMotion) {
    revealElements.forEach((element) => element.classList.add('visible'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  revealElements.forEach((element) => observer.observe(element));
}

export function initSiteChrome() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (document.documentElement.dataset.siteChromeInitialized === 'true') return;
  document.documentElement.dataset.siteChromeInitialized = 'true';
  initTheme();
  initNavigation();
  initSmoothScroll();
  initReveal();
}
