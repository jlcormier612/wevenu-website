/**
 * Approved seven-chapter Product Journey (Product page storytelling).
 * Deep magazine routes remain on PRODUCT_JOURNEY in journey.ts.
 */

export const PRODUCT_STORY_ASSETS = {
  ch01Photo: "/marketing/product-journey/ch01-photo-arrival.jpg",
  /** Originals preserved; journey uses feature crops below. */
  ch01Product: "/marketing/product-journey/ch01-product-pipeline-feature.png",
  ch02Photo: "/marketing/product-journey/ch02-photo-setup-desk.jpg",
  ch02Product: "/marketing/product-journey/ch02-product-templates-feature.png",
  ch03Photo: "/marketing/product-journey/ch03-photo-planning.jpg",
  ch03Product: "/marketing/product-journey/ch03-product-website-studio-feature.png",
  ch04Photo: "/marketing/product-journey/ch04-photo-reception.jpg",
  ch04Product: "/marketing/product-journey/ch04-product-floor-plan-feature.png",
  ch05Photo: "/marketing/product-journey/ch05-photo-florists.jpg",
  ch05Product: "/marketing/product-journey/ch05-product-vendor-tasks-feature.png",
  ch06Photo: "/marketing/product-journey/ch06-photo-coordinator.jpg",
  ch06Product: "/marketing/product-journey/ch06-product-day-sheet-feature.png",
  ch07Photo: "/marketing/product-journey/ch07-photo-celebration.jpg",
} as const;

export const PRODUCT_STORY = [
  {
    id: "first-hello",
    navTitle: "First hello",
    act: "The Foundation",
    eyebrow: "The business of booking, without the busywork.",
    headline: "Every celebration starts somewhere.",
    body: [
      "An inquiry comes in. A tour is scheduled. Questions are answered, details are shared, and a promising conversation becomes a confirmed celebration.",
      "Hello to Cheers brings the entire booking journey together—from first contact through proposals, contracts, and payments—so your team can stay focused on building relationships instead of managing the steps between them.",
    ],
    photo: {
      src: PRODUCT_STORY_ASSETS.ch01Photo,
      alt: "Olivia and James arriving at The Willow Grove on a golden afternoon",
    },
    product: {
      src: PRODUCT_STORY_ASSETS.ch01Product,
      alt: "Willow Grove pipeline with Olivia Hayes & James Hayes in Booked",
      frame: "landscape" as const,
      /** No overlap — negative margin was clipping the Pipeline heading */
      overlap: "none" as const,
    },
    /** photography left, product right */
    photoFirst: true,
  },
  {
    id: "set-up-once",
    navTitle: "Set up once",
    act: null,
    eyebrow: "The preparation that pays off, event after event.",
    headline: "Set it up your way. Let it work for you.",
    body: [
      "Every venue has its own way of doing things. Its own offerings, processes, preferences, and personal touches.",
      "Build those into Hello to Cheers once, then bring them into each new event—ready to personalize without starting from scratch. Templates, workflows, and thoughtful automation take care of the repeatable work, giving your team more time for everything that makes your venue exceptional.",
    ],
    photo: {
      src: PRODUCT_STORY_ASSETS.ch02Photo,
      alt: "Elegant Willow Grove venue setup binder and planning checklist on a sunlit desk",
    },
    product: {
      src: PRODUCT_STORY_ASSETS.ch02Product,
      alt: "Hello to Cheers Templates library with applyable venue templates",
      frame: "landscape" as const,
      overlap: "subtle" as const,
    },
    photoFirst: false,
  },
  {
    id: "their-way",
    navTitle: "Their way",
    act: "The Planning",
    eyebrow: "More freedom for your clients. Less back-and-forth for your team.",
    headline: "Their celebration. Their way to plan.",
    body: [
      "Once they're booked, your clients have a place to make the celebration their own.",
      "They can build their wedding website, organize guests and RSVPs, manage budgets, and work through personal planning—all within an experience connected to your venue. They gain independence and confidence, while your team spends less time tracking down answers and details.",
    ],
    photo: {
      src: PRODUCT_STORY_ASSETS.ch03Photo,
      alt: "Olivia and James planning their wedding together at a laptop",
    },
    product: {
      src: PRODUCT_STORY_ASSETS.ch03Product,
      alt: "Website Studio for Olivia & James at The Willow Grove",
      /** Full-length studio UI; display scale scoped in CSS */
      frame: "landscape" as const,
      overlap: "none" as const,
    },
    photoFirst: true,
  },
  {
    id: "every-detail",
    navTitle: "Every detail",
    act: null,
    eyebrow: "Collaboration without losing control.",
    headline: "Every detail, coming together.",
    body: [
      "The big decisions are exciting. The hundreds of little ones are where planning gets complicated.",
      "From layouts and seating to selections, timelines, and event details, Hello to Cheers gives clients room to participate while keeping your venue's requirements and approvals in place. Everyone can move forward with greater clarity, and your team always knows where things stand.",
    ],
    photo: {
      src: PRODUCT_STORY_ASSETS.ch04Photo,
      alt: "Reception table preparations with florals at The Willow Grove",
    },
    product: {
      src: PRODUCT_STORY_ASSETS.ch04Product,
      alt: "Floor plan starter template for a standard wedding ceremony and reception",
      frame: "landscape" as const,
      overlap: "none" as const,
      caption: "Illustrative starter layout — a reusable beginning, not a finished event plan.",
    },
    photoFirst: false,
  },
  {
    id: "partnerships",
    navTitle: "Partnerships",
    act: null,
    eyebrow: "Give every vendor a place in the process.",
    headline: "Better partnerships. Less chasing.",
    body: [
      "Great celebrations depend on great partners. But keeping everyone informed shouldn't require endless emails, phone calls, and reminders.",
      "Hello to Cheers gives vendors a dedicated place to discover opportunities, manage their work, and stay connected to the events they're part of. They have the tools to stay organized and engaged, while your team spends less time coordinating everyone else's moving parts.",
    ],
    photo: {
      src: PRODUCT_STORY_ASSETS.ch05Photo,
      alt: "Flora & Branch florists building a floral installation at The Willow Grove",
    },
    product: {
      src: PRODUCT_STORY_ASSETS.ch05Product,
      alt: "Vendor tasks for Flora & Branch on the Olivia and James celebration",
      frame: "landscape" as const,
      overlap: "none" as const,
    },
    photoFirst: true,
  },
  {
    id: "day-arrives",
    navTitle: "Day-of",
    act: null,
    eyebrow: "All the preparation, working together.",
    headline: "When the day arrives, everyone is ready.",
    body: [
      "The timeline is set. The team knows the plan. Vendors know when and where they're needed. And the details that once lived across countless messages are finally working together.",
      "With the day's schedule, responsibilities, and essential information in one connected experience, your team can spend less time coordinating the chaos—and more time making the celebration feel effortless.",
    ],
    photo: {
      src: PRODUCT_STORY_ASSETS.ch06Photo,
      alt: "Willow Grove coordinator reviewing the wedding day-of sheet",
    },
    product: {
      src: PRODUCT_STORY_ASSETS.ch06Product,
      alt: "Day-of Sheet for Olivia Hayes & James Hayes at The Willow Grove",
      /** Fill the left column; document crop has no outer chrome */
      frame: "landscape" as const,
      overlap: "none" as const,
    },
    photoFirst: false,
  },
  {
    id: "what-brought-you",
    navTitle: "Celebration",
    act: "The Celebration",
    eyebrow: "Because hospitality was always the point.",
    headline: "More time for what brought you here.",
    body: [
      "The flowers are in place. The guests have arrived. The celebration is underway.",
      "Behind every effortless moment is an extraordinary amount of work. Hello to Cheers helps bring that work together, so your team can give its attention to the people, the experience, and the moments they'll remember.",
    ],
    photo: {
      src: PRODUCT_STORY_ASSETS.ch07Photo,
      alt: "Olivia and James celebrating at dusk, with the venue coordinator quietly present",
    },
    product: null,
    photoFirst: true,
  },
] as const;

export type ProductStoryId = (typeof PRODUCT_STORY)[number]["id"];
export type ProductStoryChapter = (typeof PRODUCT_STORY)[number];
