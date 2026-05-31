/**
 * OmniDrive — Landing Country Detection
 * Detects /do path and adjusts prices, phone, and locale for Dominican Republic.
 */
(function() {
  var path = window.location.pathname;
  var isDO = path === '/do' || path === '/do/';
  window.__OMNI_COUNTRY = isDO ? 'do' : 'ec';
  window.__OMNI_CURRENCY = isDO ? 'DOP' : 'USD';
  window.__OMNI_EXCHANGE_RATE = isDO ? 55 : 1;
  if (!isDO) return;

  var cfg = {
    country: 'do',
    countryName: 'República Dominicana',
    flag: '🇩🇴',
    currency: 'RD$',
    phone: '+1 809 555 1234',
    whatsapp: '18095551234',
    email: 'rd@omnidrive.lat',
  };

  function doAll() {
    document.title = 'OmniDrive RD — Alquila o comparte vehículos en República Dominicana';

    // Nav logo
    var logo = document.querySelector('nav .logo');
    if (logo) logo.innerHTML = '🚗 OmniDrive <span style="font-size:14px;font-weight:500;color:#64748b;margin-left:4px">' + cfg.flag + '</span>';

    // Hero subtitle
    var heroP = document.querySelector('.hero p');
    if (heroP) heroP.textContent = 'Conectamos dueños de vehículos con personas que necesitan alquilar en ' + cfg.countryName + '. Verificación de cédula, seguro incluido.';

    // Phone and email in footer
    var links = document.querySelectorAll('footer a, .contact-item');
    links.forEach(function(el) {
      if (el.href && el.href.includes('wa.me/593')) el.href = 'https://wa.me/' + cfg.whatsapp;
      if (el.href && el.href.includes('@omnidrive.lat') && !el.href.includes('rd@')) el.href = 'mailto:' + cfg.email;
      if (el.textContent.includes('@omnidrive.lat') && !el.textContent.includes('rd@')) el.textContent = cfg.email;
    });

    // WhatsApp float
    var wa = document.querySelector('.whatsapp-float');
    if (wa) wa.href = 'https://wa.me/' + cfg.whatsapp;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', doAll);
  } else {
    doAll();
  }
})();
