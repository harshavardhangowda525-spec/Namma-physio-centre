/**
 * Services catalogue.
 *
 * `verified`  — supported by information supplied by / about the clinic.
 * `published` — approved for public display.
 *
 * Only services with BOTH flags set to true are shown on the public website.
 * Conditions awaiting final physiotherapist wording/scope confirmation are listed
 * in `proposedConditions` so the service detail modal transparently notes them.
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
  /** Optional legacy slugs redirected/matched in URL query parameters. */
  legacySlugs?: string[];
  title: string;
  short: string;
  description: string;
  conditions: string[];
  /** Subset of conditions shown as proposed scope awaiting final clinic sign-off. */
  proposedConditions?: string[];
  approach: string[];
  goals: string[];
  expect: string[];
  icon: ServiceIcon;
  /**
   * Path under /public. Illustrative clinical images are labelled "illustrative"
   * on the site until authentic clinic photographs are supplied.
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
    short: "Individualized clinical assessment and customized treatment protocols for pain, injury or reduced mobility.",
    description:
      "Every rehabilitation program begins with a thorough clinical assessment of your symptoms, movement patterns, medical history and functional goals. Your physiotherapist explains the findings clearly and designs an individualized, evidence-informed treatment protocol tailored to your recovery needs.",
    conditions: [
      "Joint and muscle pain",
      "Stiffness and limited functional mobility",
      "Ligament problems and soft-tissue injuries",
      "Recovery after injury",
    ],
    approach: [
      "Comprehensive clinical history and physical movement assessment",
      "Clear, plain-language explanation of clinical findings",
      "Evidence-informed hands-on therapy and guided rehabilitation exercises",
      "Customized home exercise protocol with regular progress reviews",
    ],
    goals: [
      "Ease pain and movement discomfort",
      "Restore comfortable joint and functional mobility",
      "Build clear understanding of your condition",
      "Support a confident return to everyday activities",
    ],
    expect: [
      "A focused discussion of your symptoms, daily routine and goals",
      "Individualized posture, joint mobility and strength assessment",
      "A customized treatment plan explained before care begins",
      "Dedicated time for your questions and recovery guidance",
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
    short: "Assessment-led spinal physiotherapy and customized rehabilitation for back pain, neck stiffness and disc-related conditions.",
    description:
      "Back and neck conditions can make sitting, sleeping, working and lifting difficult. We provide assessment-led physiotherapy for spinal and disc-related symptoms — including Intervertebral Disc Prolapse (IVDP) and spondylosis — focusing on appropriate movement, functional mobility and individualized rehabilitation protocols where clinically indicated.",
    conditions: [
      "Intervertebral Disc Prolapse (IVDP)",
      "Lumbar spondylosis",
      "Cervical spondylosis",
      "Lower back pain",
      "Neck pain and stiffness",
      "Pain linked to desk work or long hours of sitting",
      "Back or neck pain after awkward lifting or postural overload",
    ],
    approach: [
      "Individualized assessment of spinal movement, posture and neurological or disc-related symptoms",
      "Evidence-based manual and movement techniques where clinically appropriate",
      "Customized spinal mobility, core stability and strengthening protocols",
      "Practical ergonomic guidance on sitting, lifting and workstation habits",
    ],
    goals: [
      "Manage spinal and disc-related symptoms safely",
      "Improve spinal mobility, posture and movement control",
      "Build muscular support for the neck and lower back",
      "Return to work and daily functional activities with confidence",
    ],
    expect: [
      "Review of symptom history and any spinal imaging reports you bring",
      "Structured movement, posture and functional assessment",
      "Plain-language explanation of findings and customized care plan",
      "Guided home exercises suited to your current stage",
    ],
    icon: "spine",
    image: "/images/services/back-and-neck-pain.jpg",
    verified: true,
    published: true,
    featured: true,
    source: "Confirmed by the clinic (Nov 2026) + client request to add IVDP and spondylosis",
  },
  {
    slug: "shoulder-pain-rehabilitation",
    title: "Shoulder Pain Rehabilitation",
    short: "Personalized shoulder rehabilitation to ease pain, restore range of motion and support post-arthroscopic recovery.",
    description:
      "Shoulder conditions can restrict reaching, lifting, dressing and sleep. Through individualized clinical assessment and customized treatment protocols — including individualized rehabilitation following shoulder arthroscopy in accordance with surgical precautions — care progresses steadily to restore mobility, rotator cuff strength and functional control.",
    conditions: [
      "Frozen shoulder (stiffness)",
      "Post-arthroscopic shoulder rehabilitation",
      "Rotator cuff problems",
      "Shoulder pain when reaching or lifting",
      "Recovery after shoulder injury or surgery",
    ],
    approach: [
      "Assessment of glenohumeral and scapular movement, strength and surgical precautions",
      "Staged range-of-motion and joint mobility techniques",
      "Progressive strengthening of rotator cuff and shoulder blade stabilizers",
      "Patient-specific guidance on daily tasks, overhead activity and sleep positioning",
    ],
    goals: [
      "Reduce shoulder pain and stiffness",
      "Restore comfortable overhead and functional range of motion",
      "Rebuild shoulder stability, strength and muscular control",
      "Support safe return to household tasks, work or sport",
    ],
    expect: [
      "Discussion of your symptoms, surgical notes (if post-arthroscopy) and daily needs",
      "Gentle, appropriate movement and strength evaluation",
      "A customized rehabilitation protocol with clear milestones",
      "Structured home exercises tailored to your stage of recovery",
    ],
    icon: "hand",
    image: "/images/services/shoulder-pain-rehabilitation.jpg",
    verified: true,
    published: true,
    featured: true,
    source: "Confirmed by the clinic (Nov 2026) + client request for post-arthroscopic shoulder rehabilitation",
  },
  {
    slug: "knee-injury-rehabilitation",
    title: "Knee Injury Rehabilitation",
    short: "Customized knee rehabilitation focused on joint mobility, muscular strength, stability and confident everyday movement.",
    description:
      "Customized knee rehabilitation focused on improving joint mobility, muscular strength, functional stability and confidence in everyday movement through individualized physiotherapy protocols.",
    conditions: [
      "Meniscus injuries",
      "Ligament problems",
      "Kneecap (patellofemoral) problems",
      "Knee pain after activity",
      "Knee Osteoarthritis",
      "Rheumatoid Arthritis affecting the knee",
      "Degenerative Knee Joint Conditions",
      "Arthritis-related Knee Pain",
    ],
    proposedConditions: [
      "Knee Osteoarthritis",
      "Rheumatoid Arthritis affecting the knee",
      "Degenerative Knee Joint Conditions",
      "Arthritis-related Knee Pain",
    ],
    approach: [
      "Individualized assessment of knee mobility, swelling, ligament stability and muscular control",
      "Customized strengthening protocols for the quadriceps, hamstrings, hip and core",
      "Neuromuscular balance, alignment and functional movement training",
      "Progressive return-to-walking, stairs and physical activity planning",
    ],
    goals: [
      "Improve knee joint mobility, strength and functional stability",
      "Support meniscus, ligament and kneecap recovery",
      "Build confidence in walking, stairs and everyday activities",
      "Guide a structured return to higher-level activity where appropriate",
    ],
    expect: [
      "Review of any scans, prescriptions or surgical notes you bring",
      "Hands-on clinical knee assessment",
      "An individualized protocol progressed according to your response",
      "Targeted home rehabilitation exercises",
    ],
    icon: "activity",
    image: "/images/services/knee-injury-rehabilitation.jpg",
    verified: true,
    published: true,
    featured: true,
    source: "Client-confirmed priority order (Meniscus injuries, Ligament problems, Kneecap conditions) + arthritis subset pending final sign-off",
  },
  {
    slug: "sports-injury-rehabilitation",
    title: "Sports Injury Rehabilitation",
    short: "Assessment-led, progressive rehabilitation protocols for sports injuries to restore strength, mobility and safe return to activity.",
    description:
      "Personalized rehabilitation for sports-related injuries, focusing on restoring strength, improving mobility and supporting a safe return to physical activity through assessment-led and progressive treatment protocols.",
    conditions: [
      "Sports-related ligament problems",
      "Meniscus injuries",
      "Muscle and tendon injuries",
      "Overuse injuries",
      "Sports-related joint injuries",
      "Movement and mobility limitations following sports injuries",
    ],
    approach: [
      "Clinical assessment of the injury, biomechanics and sport-specific loading demands",
      "Customized, progressive muscle, tendon and joint strengthening protocols",
      "Balance, agility, neuromuscular coordination and movement-control drills",
      "Criteria-guided, staged return-to-training and physical activity planning",
    ],
    goals: [
      "Restore joint mobility, muscular strength and tissue load tolerance",
      "Improve movement control to help reduce re-injury risk",
      "Support a safe, confident return to sport and active recreation",
    ],
    expect: [
      "Detailed discussion of your sport, training volume and injury mechanism",
      "Functional and biomechanical assessment of the affected region",
      "Individualized rehabilitation milestones tailored to your activity goals",
      "Clear guidance on safe training modifications between sessions",
    ],
    icon: "trophy",
    image: "/images/services/sports-injury-rehabilitation.jpg",
    verified: true,
    published: true,
    featured: true,
    source: "Confirmed by the clinic for homepage primary services (Nov 2026)",
  },
  {
    slug: "post-surgical-rehabilitation",
    title: "Post-Surgical Rehabilitation",
    short: "Structured post-surgical physiotherapy guided by surgical precautions, individual recovery needs and customized protocols.",
    description:
      "Structured post-surgical physiotherapy based on individual recovery needs, surgical precautions and customized rehabilitation protocols to support mobility, strength and functional independence.",
    conditions: [
      "Post Total Knee Replacement (TKR) and Partial Knee Replacement (PKR) Rehabilitation",
      "Post Total Hip Replacement (THR) Rehabilitation",
      "Post-fracture and trauma rehabilitation",
      "Rehabilitation following fracture fixation surgery",
      "Post-Orthopaedic Surgery Rehabilitation",
      "Post-Ligament Repair Rehabilitation",
    ],
    proposedConditions: [
      "Post Total Knee Replacement (TKR) and Partial Knee Replacement (PKR) Rehabilitation",
      "Post-Orthopaedic Surgery Rehabilitation",
      "Post-Ligament Repair Rehabilitation",
    ],
    approach: [
      "Careful review of discharge summaries, surgical notes and surgeon-prescribed precautions",
      "Swelling, pain and protected early-mobility management",
      "Customized, stage-by-stage range-of-motion and strengthening protocols",
      "Gait re-education, transfer practice and functional independence training",
    ],
    goals: [
      "Restore safe joint movement within surgical guidelines",
      "Rebuild muscular strength, balance and walking confidence",
      "Support steady progression toward everyday functional independence",
    ],
    expect: [
      "Please bring your discharge summary and surgeon's post-op instructions",
      "A gentle, carefully paced initial clinical assessment",
      "An individualized home exercise and recovery guidance plan",
    ],
    icon: "scissors",
    image: "/images/services/post-surgical-rehabilitation.jpg",
    verified: true,
    published: true,
    featured: true,
    source: "Client-revised post-surgical conditions (TKR/PKR combined entry subject to final wording confirmation; THR; combined fracture & trauma)",
  },
  {
    slug: "home-visit-physiotherapy",
    title: "Home Visit Physiotherapy",
    short: "Customized home physiotherapy for older adults, post-surgical recovery, neurological conditions and limited functional mobility.",
    description:
      "Professional home physiotherapy for individuals who experience difficulty visiting the clinic, including elderly patients, individuals with neurological conditions and patients with limited functional mobility. Treatment protocols are customized according to individual assessments, recovery goals and home environments.",
    conditions: [
      "Geriatric physiotherapy and elderly rehabilitation",
      "Limited functional mobility",
      "Neurological conditions",
      "Age-related mobility limitations",
      "Balance and walking difficulties",
      "Post-surgical rehabilitation requiring home-based care",
      "Difficulty travelling to the clinic",
    ],
    approach: [
      "Individualized clinical assessment conducted safely in your home environment",
      "Customized rehabilitation protocols adapted to everyday home spaces and routines",
      "Balance, safe transfer, walking and functional independence training",
      "Practical education and guidance for family members or caregivers where helpful",
    ],
    goals: [
      "Continue structured rehabilitation when clinic travel is difficult",
      "Improve functional mobility, balance and confidence in daily movements at home",
      "Support greater independence in everyday home activities",
    ],
    expect: [
      "Submit a home visit enquiry through our online form or WhatsApp",
      "Review of appointment availability, locality and scheduling by our physiotherapist",
      "Visit confirmation, coverage details and applicable charges shared directly by the clinic",
    ],
    icon: "home",
    image: "/images/services/home-visit-physiotherapy-v3.jpg",
    verified: true,
    published: true,
    featured: true,
    source: "Supplied service information + client expansion for geriatric, neurological and limited functional mobility care",
  },
  {
    slug: "neurological-rehabilitation",
    legacySlugs: ["neurological-physiotherapy"],
    title: "Neurological Rehabilitation",
    short: "Individualized physiotherapy emphasizing movement, balance, coordination, gait and functional independence.",
    description:
      "Individualized physiotherapy for people experiencing neurological conditions, with an emphasis on movement, balance, coordination, functional mobility and independence. Each program begins with a careful assessment of functional abilities and progresses through customized rehabilitation protocols at the clinic or at home.",
    conditions: [
      "Stroke-related mobility limitations",
      "Parkinson's disease-related movement difficulties",
      "Neurological weakness",
      "Balance and coordination difficulties",
      "Gait disturbances",
      "Reduced functional mobility",
    ],
    proposedConditions: [
      "Stroke-related mobility limitations",
      "Parkinson's disease-related movement difficulties",
      "Neurological weakness",
      "Balance and coordination difficulties",
      "Gait disturbances",
      "Reduced functional mobility",
    ],
    approach: [
      "Individualized assessment of posture, muscle control, balance, coordination and gait",
      "Task-specific movement re-education and functional mobility training",
      "Progressive balance, transfer and walking exercises tailored to patient safety",
      "Structured home-program guidance with family or caregiver involvement where appropriate",
    ],
    goals: [
      "Support safer transfers, standing balance and walking patterns",
      "Improve motor coordination and functional strength",
      "Encourage greater confidence and independence in daily activities",
    ],
    expect: [
      "Review of medical history, discharge notes and current functional challenges",
      "A calm, paced movement and balance evaluation",
      "Patient-specific rehabilitation goals set collaboratively with you and your family",
      "Options for clinic-based sessions or home physiotherapy where clinically appropriate",
    ],
    icon: "brain",
    image: "/images/services/neurological-rehabilitation.jpg",
    verified: true,
    published: true,
    source: "Client request to introduce dedicated Neurological Rehabilitation section (individual condition scope flagged for final confirmation)",
  },
  {
    slug: "meniscus-injury-rehabilitation",
    title: "Meniscus Injury Rehabilitation",
    short: "Guided recovery after a meniscus tear, with or without surgery, through customized strengthening and mobility care.",
    description:
      "A meniscus tear can cause knee pain, swelling, catching or difficulty with deep bending. Whether you are managing the injury conservatively or recovering after meniscus surgery, individualized rehabilitation protocols focus on protecting the healing joint while steadily rebuilding movement, strength and control.",
    conditions: [
      "Meniscus tears",
      "Recovery after meniscus repair or arthroscopy",
      "Knee swelling and catching",
    ],
    approach: [
      "Load management matched to your stage of meniscus healing",
      "Customized range-of-motion and progressive knee-strengthening exercises",
      "Gait, balance and functional movement training",
      "Alignment with your orthopaedic surgeon's post-op protocol where applicable",
    ],
    goals: [
      "Settle knee pain and joint swelling",
      "Restore comfortable knee flexion and extension",
      "Rebuild strength and stability for daily life and physical activity",
    ],
    expect: [
      "Discussion of how the injury occurred and any MRI or surgical reports",
      "Gentle clinical evaluation of knee motion and control",
      "A personalized rehabilitation plan adjusted as your knee progresses",
    ],
    icon: "footprints",
    image: "/images/services/meniscus-injury-rehabilitation.jpg",
    verified: true,
    published: true,
    source: "Patient review (meniscus tear rehabilitation)",
  },
  {
    slug: "knee-replacement-rehabilitation",
    title: "Knee Replacement Rehabilitation",
    short: "Structured rehabilitation after Total Knee Replacement (TKR) or Partial Knee Replacement (PKR) to restore confident movement.",
    description:
      "Following Total Knee Replacement (TKR) or Partial Knee Replacement (PKR), structured physiotherapy plays a vital role in recovery. Customized treatment protocols focus on improving knee bending and straightening, rebuilding leg strength and practising walking, stairs and everyday activities safely.",
    conditions: [
      "Total Knee Replacement (TKR)",
      "Partial Knee Replacement (PKR)",
      "Post-operative knee stiffness",
    ],
    approach: [
      "Guided range-of-motion exercises for knee flexion and extension",
      "Progressive quadriceps and hip strengthening protocols",
      "Gait training, including safe progression from walking aids",
      "Stair climbing, sit-to-stand and everyday functional transfer practice",
    ],
    goals: [
      "Improve knee bend and full straightening",
      "Walk comfortably and confidently",
      "Return to independent daily routines at home and outdoors",
    ],
    expect: [
      "Sessions available at our JP Nagar clinic or via home physiotherapy early after surgery",
      "Practical guidance on swelling management and surgical precautions",
      "A clear, structured daily home exercise routine",
    ],
    icon: "bone",
    image: "/images/services/knee-replacement-rehabilitation.jpg",
    verified: true,
    published: true,
    source: "Supplied service information",
  },
  {
    slug: "joint-pain-management",
    title: "Joint Pain Management",
    short: "Evidence-informed, exercise-based care to manage joint pain, ease stiffness and maintain everyday mobility.",
    description:
      "Ongoing joint pain — including arthritis-related discomfort — can affect walking, stairs and daily independence. Assessment-led physiotherapy focuses on strengthening the muscles supporting affected joints, improving mobility and providing customized self-management strategies.",
    conditions: [
      "Knee, hip and other joint pain",
      "Arthritis-related pain and stiffness",
      "Morning joint stiffness",
      "Limited functional mobility due to joint pain",
    ],
    approach: [
      "Individualized assessment of joint mobility, muscular support and walking mechanics",
      "Customized strengthening exercises to offload and support painful joints",
      "Gentle joint mobility and flexibility techniques",
      "Practical guidance on pacing, joint protection and daily activity habits",
    ],
    goals: [
      "Ease everyday joint pain and stiffness",
      "Improve muscular support and comfortable mobility",
      "Maintain long-term activity and functional independence",
    ],
    expect: [
      "Discussion of how joint symptoms affect your daily routine",
      "Gentle movement and strength evaluation",
      "An individualized exercise program sustainable at home",
      "Regular progress reassessment",
    ],
    icon: "activity",
    image: "/images/services/joint-pain-management.jpg",
    verified: true,
    published: true,
    source: "Confirmed by the clinic (Nov 2026)",
  },
  {
    slug: "ligament-injury-rehabilitation",
    title: "Ligament & MPFL Injury Rehabilitation",
    short: "Rehabilitation for knee ligament problems, including MPFL injuries and kneecap instability.",
    description:
      "Ligament injuries need careful, staged rehabilitation. Treatment builds the muscle strength and neuromuscular control that support the joint, with progression guided by how your knee responds.",
    conditions: ["MPFL injuries", "Kneecap (patellar) instability", "Knee ligament problems", "Recovery after ligament surgery"],
    approach: [
      "Protection and symptom management early on",
      "Quadriceps, hip and core strengthening",
      "Neuromuscular control and balance training",
      "Graded return to higher-level activity",
    ],
    goals: ["Improve joint stability", "Restore strength and confidence", "Support controlled movement"],
    expect: ["Assessment of stability and movement", "A clear explanation of the stages of recovery", "Regular progress reviews"],
    icon: "link",
    image: "/images/services/ligament-injury-rehabilitation.jpg",
    verified: true,
    published: false, // kept unpublished per earlier client instruction
    source: "Patient review (high-grade MPFL tear rehabilitation)",
  },

  // ---------------- PROPOSED (not yet verified — hidden from the public site) ----------------
  proposed("orthopaedic-physiotherapy", "Orthopaedic Physiotherapy", "bone",
    "Assessment and treatment for bone, joint, muscle and ligament problems.",
    ["Joint pain", "Muscle and tendon injuries", "Ligament problems", "Fracture recovery"]),
  proposed("geriatric-physiotherapy", "Geriatric Physiotherapy", "heart",
    "Physiotherapy focused on mobility, strength and independence for older adults.",
    ["Age-related mobility limitations", "General weakness", "Balance and walking difficulties"]),
  proposed("mobility-and-balance-training", "Mobility and Balance Training", "scale",
    "Exercises to improve balance, coordination and steadiness.",
    ["Unsteadiness", "Balance difficulties", "Reduced coordination"]),
  proposed("posture-and-ergonomic-guidance", "Posture and Ergonomic Guidance", "armchair",
    "Practical guidance on posture and workstation set-up.",
    ["Desk-related discomfort", "Postural overload"]),
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
    approach: ["Individual clinical assessment", "Customized treatment protocol", "Guided exercise programme"],
    goals: ["Manage symptoms", "Improve functional mobility"],
    expect: ["An assessment of your concerns", "An explanation of the proposed plan"],
    icon,
    image: null,
    verified: false,
    published: false,
  };
}

export const publicServices = services.filter((s) => s.verified && s.published);
export const featuredServices = publicServices.filter((s) => s.featured);

/** Clinic-wide differentiators supported by verified clinic details and Google patient feedback. */
export const verifiedDifferentiators = [
  "Over 8+ years of clinical physiotherapy and rehabilitation experience",
  "Evidence-based physiotherapy guided by individual clinical assessment",
  "Customized treatment protocols tailored to your condition and recovery goals",
  "Both clinic consultations in JP Nagar and home physiotherapy visits available",
];
