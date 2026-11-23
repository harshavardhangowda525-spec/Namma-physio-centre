/**
 * Services catalogue.
 *
 * `verified`  — supported by information supplied by / about the clinic.
 * `published` — approved for public display.
 *
 * Only services with BOTH flags set to true are shown on the public website.
 * The remaining entries form a PROPOSED catalogue with draft copy that must be
 * reviewed and approved by the clinic before publishing.
 */

export type ServiceIcon =
  | "stethoscope"
  | "activity"
  | "bone"
  | "scissors"
  | "footprints"
  | "link"
  | "spine"
  | "hand"
  | "brain"
  | "heart"
  | "home"
  | "scale"
  | "armchair"
  | "dumbbell"
  | "waves"
  | "trophy";

export type Service = {
  slug: string;
  title: string;
  short: string;
  description: string;
  conditions: string[];
  approach: string[];
  goals: string[];
  expect: string[];
  icon: ServiceIcon;
  /**
   * Path under /public. The current images are AI-generated illustrations
   * (created in Figma) and are labelled "illustrative" on the site. Replace
   * with authentic clinic photographs when available.
   */
  image: string | null;
  verified: boolean;
  published: boolean;
  featured?: boolean;
  /** Where the verification came from (internal reference only). */
  source?: string;
};

export const services: Service[] = [
  {
    slug: "physiotherapy-consultation",
    title: "Physiotherapy Consultation & Treatment",
    short: "A thorough assessment and a personalised treatment plan for pain, injury or reduced movement.",
    description:
      "Your first visit focuses on understanding you: your symptoms, daily activities, medical history and what you want to get back to. From there, your physiotherapist explains what they find in plain language and works with you on a treatment plan tailored to your needs.",
    conditions: ["Joint and muscle pain", "Stiffness and reduced mobility", "Sprains and strains", "Recovery after injury"],
    approach: [
      "Detailed history and physical assessment",
      "Clear explanation of findings",
      "Hands-on treatment and guided exercise where appropriate",
      "A home exercise programme you can follow confidently",
    ],
    goals: ["Reduce pain", "Restore comfortable movement", "Build understanding of your condition", "Support a safe return to daily activities"],
    expect: [
      "A conversation about your concerns and goals",
      "Movement and strength assessment",
      "An explanation of the proposed plan before treatment begins",
      "Time for your questions",
    ],
    icon: "stethoscope",
    image: "/images/services/physiotherapy-consultation.jpg",
    verified: true,
    published: true,
    featured: true,
    source: "Google listing category: Physiotherapy Centre",
  },
  {
    slug: "back-and-neck-pain",
    title: "Back and Neck Pain Physiotherapy",
    short: "Assessment and treatment for back and neck pain, stiffness and related discomfort.",
    description:
      "Back and neck pain can make sitting, sleeping, working and lifting difficult. Your physiotherapist looks at how you move, sit and work, explains what may be contributing to your symptoms, and builds a plan combining hands-on care where appropriate with exercises to improve mobility, strength and posture.",
    conditions: [
      "Lower back pain",
      "Neck pain and stiffness",
      "Pain linked to desk work or long hours of sitting",
      "Back or neck pain after strain or awkward lifting",
    ],
    approach: [
      "Assessment of posture, spinal movement and muscle strength",
      "Hands-on techniques where appropriate",
      "Mobility and core-strengthening exercises",
      "Practical advice on sitting, lifting and workstation set-up",
    ],
    goals: [
      "Ease pain and stiffness",
      "Improve spinal mobility and posture",
      "Build strength to support the back and neck",
      "Return to work and daily activities with confidence",
    ],
    expect: [
      "Questions about when and how the pain started",
      "A movement and posture assessment",
      "An explanation of findings in plain language",
      "Simple exercises to begin at home",
    ],
    icon: "spine",
    image: "/images/services/back-and-neck-pain.jpg",
    verified: true,
    published: true,
    featured: true,
    source: "Confirmed by the clinic (client request, Nov 2026)",
  },
  {
    slug: "shoulder-pain-rehabilitation",
    title: "Shoulder Pain Rehabilitation",
    short: "Treatment to ease shoulder pain and restore comfortable movement and strength.",
    description:
      "Shoulder problems can affect reaching, lifting, dressing and sleep. Rehabilitation starts with understanding what is limiting your shoulder, then progresses step by step to restore range of motion, strength and control so you can use your arm comfortably again.",
    conditions: [
      "Frozen shoulder (stiffness)",
      "Rotator cuff problems",
      "Shoulder pain when reaching or lifting",
      "Recovery after shoulder injury or surgery",
    ],
    approach: [
      "Assessment of shoulder movement, strength and posture",
      "Range-of-motion and mobility work",
      "Progressive strengthening of the shoulder and shoulder blade",
      "Guidance on daily activities and sleeping positions",
    ],
    goals: [
      "Reduce shoulder pain",
      "Restore range of motion",
      "Rebuild strength and control",
      "Return to everyday tasks, work or sport",
    ],
    expect: [
      "A discussion of your symptoms and daily activities",
      "Gentle movement and strength tests",
      "A staged plan with clear milestones",
      "Home exercises you can follow",
    ],
    icon: "hand",
    image: "/images/services/shoulder-pain-rehabilitation.jpg",
    verified: true,
    published: true,
    featured: true,
    source: "Confirmed by the clinic (client request, Nov 2026)",
  },
  {
    slug: "knee-injury-rehabilitation",
    title: "Knee Injury Rehabilitation",
    short: "Structured, progressive rehabilitation to help you regain strength, stability and confidence in your knee.",
    description:
      "Knee injuries can affect walking, stairs, sport and sleep. Rehabilitation is planned around the type of injury and your goals, progressing step by step from settling symptoms to rebuilding strength, control and confidence.",
    conditions: ["Ligament sprains", "Meniscus injuries", "Kneecap (patellofemoral) problems", "Knee pain after activity"],
    approach: [
      "Assessment of movement, swelling, strength and stability",
      "Progressive strengthening of the knee, hip and core",
      "Balance and control training",
      "Gradual return-to-activity planning",
    ],
    goals: ["Improve knee strength and stability", "Restore range of motion", "Return to walking, stairs and daily tasks", "Plan a safe return to sport where relevant"],
    expect: ["Review of any scans or reports you bring", "Hands-on assessment", "A staged plan with clear milestones", "Exercises to practise at home"],
    icon: "activity",
    image: "/images/services/knee-injury-rehabilitation.jpg",
    verified: true,
    published: true,
    featured: true,
    source: "Patient reviews (knee rehabilitation)",
  },
  {
    slug: "meniscus-injury-rehabilitation",
    title: "Meniscus Injury Rehabilitation",
    short: "Guided recovery after a meniscus tear, with or without surgery.",
    description:
      "A meniscus tear can cause pain, swelling, catching or locking. Whether you are managing the injury conservatively or recovering after surgery, rehabilitation focuses on protecting the healing knee while steadily rebuilding movement and strength.",
    conditions: ["Meniscus tears", "Recovery after meniscus repair or arthroscopy", "Knee swelling and catching"],
    approach: [
      "Load management appropriate to your stage of healing",
      "Range-of-motion and strengthening exercises",
      "Gait and functional movement training",
      "Coordination with your surgeon's protocol where applicable",
    ],
    goals: ["Settle pain and swelling", "Restore knee movement", "Rebuild strength for daily life and activity"],
    expect: ["Questions about how the injury happened", "Gentle assessment of movement", "A plan matched to your recovery stage"],
    icon: "footprints",
    image: "/images/services/meniscus-injury-rehabilitation.jpg",
    verified: true,
    published: true,
    source: "Patient review (meniscus tear rehabilitation)",
  },
  {
    slug: "sports-injury-rehabilitation",
    title: "Sports Injury Rehabilitation",
    short: "Structured rehabilitation to help you recover from sports injuries and plan a safe return to play.",
    description:
      "Whether you play cricket, football, badminton or run, sports injuries need rehabilitation that matches the demands of your activity. Your plan progresses from settling symptoms to rebuilding strength, movement control and sport-specific fitness, with a staged return to training.",
    conditions: [
      "Muscle strains and ligament sprains",
      "Knee and ankle injuries",
      "Overuse injuries from training",
      "Recovery after a sports-related surgery",
    ],
    approach: [
      "Assessment of the injury and how your sport loads it",
      "Progressive strengthening and conditioning",
      "Balance, agility and movement-control drills",
      "A staged return-to-sport plan",
    ],
    goals: [
      "Recover strength and movement",
      "Improve movement control to help reduce the risk of re-injury",
      "Return to training and competition safely",
    ],
    expect: [
      "Questions about your sport and training load",
      "An assessment of the injured area",
      "A clear plan with milestones",
      "Guidance on what to do between sessions",
    ],
    icon: "trophy",
    image: "/images/services/sports-injury-rehabilitation.jpg",
    verified: true,
    published: true,
    source: "Confirmed by the clinic (client request, Nov 2026)",
  },
  {
    slug: "ligament-injury-rehabilitation",
    title: "Ligament & MPFL Injury Rehabilitation",
    short: "Rehabilitation for knee ligament injuries, including MPFL tears and kneecap instability.",
    description:
      "Ligament injuries, including injuries to the medial patellofemoral ligament (MPFL) that stabilises the kneecap, need careful, staged rehabilitation. Treatment builds the muscle strength and control that support the joint, with progression guided by how your knee responds.",
    conditions: ["MPFL tears", "Kneecap (patellar) instability", "Knee ligament sprains", "Recovery after ligament surgery"],
    approach: [
      "Protection and symptom management early on",
      "Quadriceps, hip and core strengthening",
      "Neuromuscular control and balance training",
      "Graded return to higher-level activity",
    ],
    goals: ["Improve joint stability", "Restore strength and confidence", "Reduce the risk of repeat injury through better control"],
    expect: ["Assessment of stability and movement", "A clear explanation of the stages of recovery", "Regular progress reviews"],
    icon: "link",
    image: "/images/services/ligament-injury-rehabilitation.jpg",
    verified: true,
    published: false, // removed from the public site at the client's request (Nov 2026)
    source: "Patient review (high-grade MPFL tear rehabilitation)",
  },
  {
    slug: "post-surgical-rehabilitation",
    title: "Post-Surgical Rehabilitation",
    short: "Supportive rehabilitation after orthopaedic surgery, aligned with your surgeon's guidance.",
    description:
      "The weeks after surgery are important for recovery. Post-surgical physiotherapy aims to help you regain movement, strength and independence safely, following any precautions or protocols set by your surgical team.",
    conditions: ["Recovery after knee surgery", "Recovery after ligament or meniscus surgery", "Stiffness and weakness after surgery"],
    approach: [
      "Review of your surgical notes and precautions",
      "Swelling and pain management strategies",
      "Progressive mobility and strengthening",
      "Walking and functional training",
    ],
    goals: ["Restore safe, comfortable movement", "Regain strength and independence", "Support your return to everyday life"],
    expect: ["Please bring your discharge summary and surgeon's instructions", "A gentle, paced first session", "A home exercise plan"],
    icon: "scissors",
    image: "/images/services/post-surgical-rehabilitation.jpg",
    verified: true,
    published: true,
    featured: true,
    source: "Supplied service information",
  },
  {
    slug: "knee-replacement-rehabilitation",
    title: "Knee Replacement Rehabilitation",
    short: "Rehabilitation after total or partial knee replacement to help you walk and move with more confidence.",
    description:
      "After a knee replacement, consistent rehabilitation plays a big part in how well you move. Sessions focus on bending and straightening the knee, building strength, and practising walking, stairs and everyday tasks.",
    conditions: ["Total knee replacement", "Partial knee replacement", "Post-operative stiffness"],
    approach: [
      "Range-of-motion work for bending and straightening",
      "Progressive strengthening",
      "Gait training, including walking aids where needed",
      "Stair and transfer practice",
    ],
    goals: ["Improve knee bend and straightening", "Walk more confidently", "Return to daily routines"],
    expect: ["Sessions at the clinic or at home", "Guidance on managing swelling", "A clear home programme"],
    icon: "bone",
    image: "/images/services/knee-replacement-rehabilitation.jpg",
    verified: true,
    published: true,
    source: "Supplied service information",
  },
  {
    slug: "joint-pain-management",
    title: "Joint Pain Management",
    short: "Exercise-based care to help manage joint pain and stiffness and keep you moving.",
    description:
      "Ongoing joint pain, including pain related to arthritis, can limit walking, stairs and everyday tasks. Physiotherapy focuses on strengthening the muscles around the joint, improving mobility and teaching practical ways to manage symptoms day to day.",
    conditions: [
      "Knee, hip and other joint pain",
      "Arthritis-related pain and stiffness",
      "Morning stiffness",
      "Reduced mobility because of joint pain",
    ],
    approach: [
      "Assessment of joint movement, strength and walking",
      "Strengthening exercises to support the joint",
      "Mobility and flexibility work",
      "Practical advice on activity, pacing and daily tasks",
    ],
    goals: [
      "Reduce pain and stiffness",
      "Improve strength and mobility",
      "Stay active and independent",
    ],
    expect: [
      "A discussion of how joint pain affects your day",
      "A movement and strength assessment",
      "A plan you can continue at home",
      "Regular progress reviews",
    ],
    icon: "activity",
    image: "/images/services/joint-pain-management.jpg",
    verified: true,
    published: true,
    source: "Confirmed by the clinic (client request, Nov 2026)",
  },
  {
    slug: "home-visit-physiotherapy",
    title: "Home Visit Physiotherapy",
    short: "Physiotherapy in the comfort of your home when travelling to the clinic is difficult.",
    description:
      "Home visits can help when travel is difficult, for example soon after surgery or for older adults with limited mobility. Your physiotherapist assesses you in your own surroundings and tailors exercises to your home environment.",
    conditions: ["Recovery after surgery", "Limited mobility", "Difficulty travelling to the clinic"],
    approach: [
      "Assessment in your home environment",
      "Exercises using everyday surroundings",
      "Guidance for family members or carers where helpful",
    ],
    goals: ["Continue rehabilitation without travel", "Improve safety and independence at home"],
    expect: [
      "A request through our booking form",
      "A call from the clinic to confirm the visit, area and timing",
      "Visit coverage and charges confirmed by the clinic",
    ],
    icon: "home",
    image: "/images/services/home-visit-physiotherapy.jpg",
    verified: true,
    published: true,
    featured: true,
    source: "Supplied service information",
  },

  // ---------------- PROPOSED (not yet verified — hidden from the public site) ----------------
  proposed("orthopaedic-physiotherapy", "Orthopaedic Physiotherapy", "bone",
    "Assessment and treatment for bone, joint, muscle and ligament problems.",
    ["Joint pain", "Muscle strains", "Fracture recovery", "Tendon problems"]),
  proposed("neurological-physiotherapy", "Neurological Physiotherapy", "brain",
    "Rehabilitation for movement difficulties related to neurological conditions.",
    ["Stroke recovery", "Balance difficulties", "Mobility after neurological illness"]),
  proposed("geriatric-physiotherapy", "Geriatric Physiotherapy", "heart",
    "Physiotherapy focused on mobility, strength and independence for older adults.",
    ["Reduced mobility", "Weakness", "Fall-risk concerns"]),
  proposed("mobility-and-balance-training", "Mobility and Balance Training", "scale",
    "Exercises to improve balance, coordination and steadiness.",
    ["Unsteadiness", "Fear of falling", "Reduced coordination"]),
  proposed("posture-and-ergonomic-guidance", "Posture and Ergonomic Guidance", "armchair",
    "Practical guidance on posture and workstation set-up.",
    ["Desk-related discomfort", "Postural strain"]),
  proposed("strengthening-and-conditioning", "Muscle Strengthening and Conditioning", "dumbbell",
    "Progressive strengthening programmes tailored to your needs.",
    ["General weakness", "Deconditioning after illness or injury"]),
  proposed("chronic-pain-rehabilitation", "Chronic Pain Rehabilitation", "waves",
    "Supportive, active rehabilitation for long-standing pain.",
    ["Persistent pain", "Pain affecting daily activity"]),
];

function proposed(slug: string, title: string, icon: ServiceIcon, short: string, conditions: string[]): Service {
  return {
    slug,
    title,
    short,
    description: `${short} (Draft copy: requires clinic review and approval before publishing.)`,
    conditions,
    approach: ["Individual assessment", "Personalised treatment plan", "Guided exercise programme"],
    goals: ["Reduce symptoms", "Improve function and movement"],
    expect: ["An assessment of your concerns", "An explanation of the proposed plan"],
    icon,
    image: null,
    verified: false,
    published: false,
  };
}

export const publicServices = services.filter((s) => s.verified && s.published);
export const featuredServices = publicServices.filter((s) => s.featured);

/** Clinic-wide differentiators that are supported by supplied information only. */
export const verifiedDifferentiators = [
  "Patients on Google describe clear explanations and a friendly, professional approach",
  "Patients on Google have mentioned the clinic's cleanliness",
  "Both clinic visits and home visits can be requested",
  "Rehabilitation plans are tailored to each patient",
];
