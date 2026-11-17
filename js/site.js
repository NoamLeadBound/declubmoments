/* Page behaviour: solid nav after the hero, reveal on scroll, the day builder,
   the mobile booking bar. The form and the visit tracking live in lp.js. */
(function () {
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var io = "IntersectionObserver" in window;

  // Nav turns solid once the page scrolls.
  var nav = document.getElementById("nav");
  function navState() {
    if (nav) nav.classList.toggle("is-solid", scrollY > 24);
  }
  addEventListener("scroll", navState, { passive: true });
  navState();

  // Hero video: still frame for reduced motion.
  var reel = document.querySelector("video.reel");
  if (reel && reduce) {
    reel.removeAttribute("autoplay");
    reel.pause();
  }

  // Reveal on scroll.
  var items = document.querySelectorAll(".reveal");
  if (io && !reduce) {
    var ro = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            ro.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    items.forEach(function (el) {
      ro.observe(el);
    });
  } else {
    items.forEach(function (el) {
      el.classList.add("is-in");
    });
  }

  // Day builder: a pace lights its floors.
  var stack = document.querySelector(".stack");
  document.querySelectorAll(".route").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".route").forEach(function (b) {
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      });
      if (stack) stack.setAttribute("data-route", btn.getAttribute("data-route"));
    });
  });

  // Logo carousel: repeat the list until it overfills the strip, then loop by
  // exactly one list width, so it runs endlessly at any screen size.
  var mq = document.querySelector(".marquee");
  var inner = mq && mq.querySelector(".marquee__inner");
  var first = inner && inner.querySelector(".marquee__list");
  function buildMarquee() {
    if (!first) return;
    inner.querySelectorAll(".marquee__list.clone").forEach(function (n) {
      n.remove();
    });
    var w = first.getBoundingClientRect().width;
    if (!w) return;
    var copies = Math.max(1, Math.ceil((mq.clientWidth * 2) / w));
    for (var i = 0; i < copies; i++) {
      var c = first.cloneNode(true);
      c.classList.add("clone");
      c.setAttribute("aria-hidden", "true");
      c.querySelectorAll("img").forEach(function (im) {
        im.alt = "";
      });
      inner.appendChild(c);
    }
    inner.style.setProperty("--shift", -w + "px");
    inner.style.setProperty("--dur", (w / 48).toFixed(1) + "s");
  }
  if (first) {
    buildMarquee();
    addEventListener("load", buildMarquee);
    var rt;
    addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(buildMarquee, 200);
    });
  }

  // Mobile booking bar: after the hero, hidden while the form is on screen.
  var bar = document.querySelector(".bar");
  var hero = document.querySelector(".hero");
  var form = document.getElementById("form");
  if (bar && hero && form && io) {
    var pastHero = false;
    var formOn = false;
    var set = function () {
      bar.classList.toggle("is-in", pastHero && !formOn);
    };
    new IntersectionObserver(function (e) {
      pastHero = !e[0].isIntersecting;
      set();
    }).observe(hero);
    new IntersectionObserver(
      function (e) {
        formOn = e[0].isIntersecting;
        set();
      },
      { threshold: 0.1 }
    ).observe(form);
  }
})();
