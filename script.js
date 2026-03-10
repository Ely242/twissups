const menuBtn = document.getElementById("menuBtn");
const navLinks = document.getElementById("navLinks");
const faqItems = document.querySelectorAll(".faq-item");

if (menuBtn && navLinks) {
  menuBtn.addEventListener("click", () => {
    navLinks.classList.toggle("mobile-open");
  });

  document.querySelectorAll(".nav-links a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("mobile-open");
    });
  });
}

if (faqItems.length > 0) {
  faqItems.forEach((item) => {
    const question = item.querySelector(".faq-question");
    if (!question) {
      return;
    }

    question.addEventListener("click", () => {
      const isActive = item.classList.contains("active");

      faqItems.forEach((faq) => faq.classList.remove("active"));

      if (!isActive) {
        item.classList.add("active");
      }
    });
  });
}
