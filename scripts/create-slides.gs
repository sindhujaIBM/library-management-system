// Library Management System — Google Slides Generator
// Paste into script.google.com → Run → createPresentation
// View → Logs to get the presentation URL

function createPresentation() {
  const pres = SlidesApp.create('Library Management System — AI-Powered');
  pres.getSlides()[0].remove();

  // ── Colors (0-255 integers) ───────────────────────────────
  const NAVY  = [21,  34,  68];
  const BLUE  = [31, 100, 200];
  const TEAL  = [10, 171, 160];
  const WHITE = [255, 255, 255];
  const LIGHT = [245, 247, 252];
  const GRAY  = [100, 110, 125];
  const AMBER = [250, 171,  36];
  const GREEN = [ 33, 166, 112];
  const DKBLU = [ 30,  56, 122]; // dark blue card bg
  const PURP  = [115,  38, 190];

  // ── Helpers ──────────────────────────────────────────────

  function addSlide() {
    return pres.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  }

  function setBg(slide, c) {
    slide.getBackground().setSolidFill(c[0], c[1], c[2]);
  }

  function addRect(slide, x, y, w, h, fill) {
    const shape = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, x, y, w, h);
    shape.getFill().setSolidFill(fill[0], fill[1], fill[2]);
    shape.getBorder().setTransparent();
    return shape;
  }

  function addText(slide, text, x, y, w, h, opts) {
    const shape = slide.insertTextBox(text, x, y, w, h);
    shape.getFill().setTransparent();
    shape.getBorder().setTransparent();
    const ts = shape.getText().getTextStyle();
    ts.setFontFamily('Google Sans');
    ts.setFontSize(opts.size || 12);
    ts.setBold(opts.bold || false);
    const c = opts.color || WHITE;
    ts.setForegroundColor(c[0], c[1], c[2]);
    const align = opts.align || 'LEFT';
    shape.getText().getParagraphStyle().setParagraphAlignment(
      align === 'CENTER' ? SlidesApp.ParagraphAlignment.CENTER :
      align === 'RIGHT'  ? SlidesApp.ParagraphAlignment.END :
                           SlidesApp.ParagraphAlignment.START
    );
    return shape;
  }

  function tagBar(slide, label, accent) {
    addRect(slide, 0, 0, 720, 7, accent);
    const tag = addRect(slide, 36, 16, 200, 26, accent);
    const t = tag.getText();
    t.setText(label.toUpperCase());
    t.getTextStyle().setFontFamily('Google Sans').setFontSize(9).setBold(true)
      .setForegroundColor(NAVY[0], NAVY[1], NAVY[2]);
    t.getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
  }

  function labelBox(slide, text, x, y, w, h, bg, fg) {
    const r = addRect(slide, x, y, w, h, bg);
    const t = r.getText();
    t.setText(text);
    t.getTextStyle().setFontFamily('Google Sans').setFontSize(10).setBold(true)
      .setForegroundColor(fg[0], fg[1], fg[2]);
    t.getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
    return r;
  }

  // ════════════════════════════════════════════════════════
  // SLIDE 1 — TITLE
  // ════════════════════════════════════════════════════════
  {
    const s = addSlide();
    setBg(s, NAVY);
    addRect(s, 0, 0, 7, 405, TEAL);

    addText(s, 'Library Management System', 40, 90, 620, 70, { size: 34, bold: true, color: WHITE });
    addText(s, 'AI-Powered Operational Intelligence', 40, 170, 620, 36, { size: 19, color: TEAL });
    addText(s, 'Sindhuja Kalisrinivasan  ·  2026', 40, 345, 400, 28, { size: 12, color: GRAY });

    const tags = ['React + TypeScript', 'AWS Lambda', 'DynamoDB', 'Claude Haiku', 'EventBridge'];
    tags.forEach((tag, i) => {
      labelBox(s, tag, 490, 120 + i * 46, 200, 34, BLUE, WHITE);
    });
  }

  // ════════════════════════════════════════════════════════
  // SLIDE 2 — THE PROBLEM
  // ════════════════════════════════════════════════════════
  {
    const s = addSlide();
    setBg(s, LIGHT);
    tagBar(s, '01  The Problem', BLUE);

    addText(s, 'Libraries run blind.', 36, 50, 640, 50, { size: 30, bold: true, color: NAVY });

    const rows = [
      ['Manual tracking',    'Paper ledgers or basic spreadsheets — no real-time availability.'],
      ['No demand signals',  'Librarians guess which books to reorder; popular titles have 10-person queues.'],
      ['Stale inventory',    'Books untouched for years occupy shelf space with no trigger to review.'],
      ['Missed due dates',   'No automated renewal, no smart reminders — overdue books stay overdue.'],
    ];

    rows.forEach(([title, body], i) => {
      const y = 115 + i * 62;
      addRect(s, 36, y, 648, 52, WHITE);
      addText(s, title, 50, y + 6,  180, 20, { size: 13, bold: true, color: NAVY });
      addText(s, body,  50, y + 26, 620, 20, { size: 11, color: GRAY });
    });

    addText(s, 'Solution: serverless, AI-augmented system that surfaces signals automatically — humans stay in control.', 36, 376, 648, 32, { size: 11, color: BLUE });
  }

  // ════════════════════════════════════════════════════════
  // SLIDE 3 — USER PERSONAS
  // ════════════════════════════════════════════════════════
  {
    const s = addSlide();
    setBg(s, LIGHT);
    tagBar(s, '02  User Personas', TEAL);

    addText(s, 'Two roles, one Google login.', 36, 50, 640, 45, { size: 26, bold: true, color: NAVY });

    // Member
    addRect(s, 36, 108, 308, 266, WHITE);
    addText(s, 'Member', 54, 118, 260, 28, { size: 16, bold: true, color: NAVY });
    const mPerms = ['Search & browse catalog', 'Borrow & return books', 'Place / cancel holds', 'View own loan history', 'AI book recommendations', 'Email notifications'];
    mPerms.forEach((p, i) => addText(s, '•  ' + p, 54, 154 + i * 30, 275, 26, { size: 12, color: GRAY }));

    // Librarian
    addRect(s, 358, 108, 326, 266, NAVY);
    addText(s, 'Librarian', 374, 118, 280, 28, { size: 16, bold: true, color: WHITE });
    const lPerms = ['Everything Members can do', 'Add / edit / delete books', 'View all loans & overdue', 'Manage hold queues', 'AI insights dashboard', 'Approve / reject AI alerts', 'Promote users to librarian'];
    lPerms.forEach((p, i) => addText(s, '•  ' + p, 374, 154 + i * 30, 294, 26, { size: 12, color: WHITE }));

    addText(s, 'Role encoded in JWT. Default = member. Promotion requires an existing librarian — never self-assigned.', 36, 386, 648, 24, { size: 10, color: GRAY });
  }

  // ════════════════════════════════════════════════════════
  // SLIDE 4 — ACCESS PATTERNS
  // ════════════════════════════════════════════════════════
  {
    const s = addSlide();
    setBg(s, LIGHT);
    tagBar(s, '03  Access Patterns — DynamoDB Single Table', AMBER);

    addText(s, 'Single table. Four entity types. Four GSIs.', 36, 50, 640, 40, { size: 24, bold: true, color: NAVY });

    const colX = [36, 130, 285, 420];
    const colW = [90, 150, 132, 264];
    const headers = ['Entity', 'PK', 'SK', 'Access Pattern'];
    headers.forEach((h, i) => {
      const r = addRect(s, colX[i], 108, colW[i], 26, NAVY);
      const t = r.getText();
      t.setText(h);
      t.getTextStyle().setFontFamily('Google Sans').setFontSize(11).setBold(true).setForegroundColor(255, 255, 255);
      t.getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.START);
    });

    const rows = [
      ['Book',     'BOOK#ISBN',      'METADATA',         'Get book by ISBN; edit/delete'],
      ['Loan',     'LOAN#ISBN',      'LOAN#userId#date', 'All loans per book, sorted by date'],
      ['User',     'USER#userId',    'METADATA',         'Get user profile & role'],
      ['Waitlist', 'WAITLIST#ISBN',  'USER#userId',      'Hold queue per book, ordered'],
    ];
    rows.forEach((row, ri) => {
      const y = 136 + ri * 34;
      const bg = ri % 2 === 0 ? WHITE : [236, 240, 250];
      row.forEach((cell, ci) => {
        addRect(s, colX[ci], y, colW[ci], 32, bg);
        addText(s, cell, colX[ci] + 4, y + 6, colW[ci] - 6, 22, { size: 11, color: NAVY });
      });
    });

    addText(s, 'Global Secondary Indexes', 36, 284, 300, 24, { size: 14, bold: true, color: NAVY });
    const gsis = [
      ['GSI1', 'author → releaseDate',   'Browse by author'],
      ['GSI2', 'genre → author',         'Browse by genre'],
      ['GSI3', 'userId → checkoutDate',  'All loans for a user'],
      ['GSI4', 'status → returnDueDate', 'Active loans by due date (overdue detection)'],
    ];
    gsis.forEach(([name, keys, use], i) => {
      const x = 36 + (i < 2 ? 0 : 345), y = 310 + (i % 2) * 38;
      addRect(s, x, y, 330, 32, WHITE);
      addText(s, name, x + 6, y + 6, 45, 22, { size: 11, bold: true, color: BLUE });
      addText(s, keys, x + 54, y + 6, 148, 22, { size: 11, color: NAVY });
      addText(s, use,  x + 205, y + 6, 120, 22, { size: 10, color: GRAY });
    });
  }

  // ════════════════════════════════════════════════════════
  // SLIDE 5 — ARCHITECTURE
  // ════════════════════════════════════════════════════════
  {
    const s = addSlide();
    setBg(s, NAVY);
    tagBar(s, '04  Architecture', TEAL);

    addText(s, 'Serverless. Event-driven. AWS-native.', 36, 50, 640, 40, { size: 26, bold: true, color: WHITE });

    // Tier headers
    const tiers = [
      { label: 'Frontend',    x: 36,  w: 116, color: BLUE },
      { label: 'API Gateway', x: 162, w: 100, color: TEAL },
      { label: 'Lambda',      x: 272, w: 126, color: BLUE },
      { label: 'Data',        x: 408, w: 138, color: TEAL },
      { label: 'AI / Agents', x: 556, w: 148, color: AMBER },
    ];
    tiers.forEach(t => labelBox(s, t.label, t.x, 104, t.w, 24, t.color, NAVY));

    // Component boxes
    const comps = [
      { label: 'React + TS',         x: 36,  y: 136, w: 116, h: 52, bg: DKBLU },
      { label: 'Hosted on\nS3 + CDN', x: 36,  y: 194, w: 116, h: 40, bg: DKBLU },
      { label: 'REST API\nGateway',  x: 162, y: 136, w: 100, h: 98, bg: [16,128,120] },
      { label: 'Auth\nLambdas',      x: 272, y: 136, w: 126, h: 44, bg: DKBLU },
      { label: 'Book\nLambdas',      x: 272, y: 184, w: 126, h: 44, bg: DKBLU },
      { label: 'Loan\nLambdas',      x: 272, y: 232, w: 126, h: 44, bg: DKBLU },
      { label: 'AI\nLambdas',        x: 272, y: 280, w: 126, h: 44, bg: DKBLU },
      { label: 'DynamoDB\nSingle Table', x: 408, y: 136, w: 138, h: 52, bg: [16,128,120] },
      { label: 'OpenSearch\n(full-text)', x: 408, y: 192, w: 138, h: 44, bg: [16,128,120] },
      { label: 'SES Email',          x: 408, y: 240, w: 138, h: 44, bg: [16,128,120] },
      { label: 'Claude Haiku\n(Bedrock)', x: 556, y: 136, w: 148, h: 52, bg: [128, 90, 10] },
      { label: 'Nova Micro\n(Bedrock)',   x: 556, y: 192, w: 148, h: 44, bg: [128, 90, 10] },
      { label: 'EventBridge\nScheduler', x: 556, y: 240, w: 148, h: 44, bg: [128, 90, 10] },
    ];
    comps.forEach(c => {
      const r = addRect(s, c.x, c.y, c.w, c.h, c.bg);
      const t = r.getText();
      t.setText(c.label);
      t.getTextStyle().setFontFamily('Google Sans').setFontSize(10)
        .setForegroundColor(WHITE[0], WHITE[1], WHITE[2]);
      t.getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
    });

    addText(s, 'DynamoDB Stream  →  indexToOpenSearch Lambda  (real-time sync, eventually consistent)', 36, 300, 668, 22, { size: 10, color: TEAL });
    addText(s, 'Google OAuth 2.0  →  JWT (httpOnly cookie)  →  Lambda middleware role check', 36, 318, 668, 22, { size: 10, color: GRAY });
    addText(s, 'DLQ on all EventBridge agents  ·  Structured logging + correlation ID per request', 36, 336, 668, 22, { size: 10, color: GRAY });
  }

  // ════════════════════════════════════════════════════════
  // SLIDE 6 — LOAN LIFECYCLE FLOW
  // ════════════════════════════════════════════════════════
  {
    const s = addSlide();
    setBg(s, LIGHT);
    tagBar(s, '05  Loan Lifecycle Flow — 42 Days Total', BLUE);

    addText(s, 'Automated renewal. Smart reminders. Human returns.', 36, 50, 640, 40, { size: 24, bold: true, color: NAVY });

    const steps = [
      { day: 'Day 1',   label: 'Checkout',       detail: 'TransactWriteItems: decrement availableCopies + create Loan atomically. Conditional write guards last copy.', color: BLUE },
      { day: 'Day 18',  label: 'Reminder',        detail: 'SES: "Your book is due in 3 days." Triggered by loanLifecycleAgent (EventBridge daily).', color: TEAL },
      { day: 'Day 21',  label: 'Auto-Renew',      detail: 'If renewalCount=0 AND no hold queue → extend +21 days, set renewalCount=1. SES notifies borrower.', color: GREEN },
      { day: 'Day 39',  label: 'Final Reminder',  detail: 'SES: "Due in 3 days — no further renewals available."', color: AMBER },
      { day: 'Day 42+', label: 'Overdue',         detail: 'Daily SES overdue notice until returned. Hold queue notified when book becomes available.', color: [210, 50, 50] },
    ];

    steps.forEach((step, i) => {
      const y = 106 + i * 54;
      labelBox(s, step.day, 36, y, 72, 40, step.color, NAVY);
      addText(s, step.label, 120, y + 2, 160, 20, { size: 13, bold: true, color: NAVY });
      addText(s, step.detail, 120, y + 22, 564, 20, { size: 11, color: GRAY });
      if (i < steps.length - 1) {
        const line = s.insertLine(SlidesApp.LineCategory.STRAIGHT, 72, y + 40, 72, y + 54);
        line.getLineFill().setSolidFill(180, 190, 210);
        line.setWeight(2);
      }
    });

    addText(s, 'Auto-renew blocked if: renewalCount > 0  OR  active hold queue exists on the book.', 36, 382, 648, 22, { size: 11, color: BLUE });
  }

  // ════════════════════════════════════════════════════════
  // SLIDE 7 — EVENTBRIDGE SCHEDULES
  // ════════════════════════════════════════════════════════
  {
    const s = addSlide();
    setBg(s, NAVY);
    tagBar(s, '06  EventBridge Scheduled Agents', AMBER);

    addText(s, 'Background intelligence. No user trigger required.', 36, 50, 640, 40, { size: 26, bold: true, color: WHITE });

    const agents = [
      { freq: 'Daily',  name: 'loanLifecycleAgent',    color: BLUE,  desc: 'Processes all active loans: auto-renews eligible, sends 3-day reminders, sends overdue notices daily.' },
      { freq: 'Daily',  name: 'demandDetectionAgent',  color: TEAL,  desc: 'Books with 5+ waitlist holds → Claude Haiku generates order recommendation → written to admin_alerts (pending).' },
      { freq: 'Weekly', name: 'staleInventoryAgent',   color: AMBER, desc: 'Books not borrowed in 6+ months → Haiku generates auction recommendation → admin_alerts (pending).' },
      { freq: 'Weekly', name: 'seriesReleaseAgent',    color: GREEN, desc: 'Google Books API → new series entries → Haiku drafts SES → sent to users who borrowed from that series.' },
    ];

    agents.forEach((a, i) => {
      const y = 108 + i * 72;
      addRect(s, 36, y, 648, 62, DKBLU);
      labelBox(s, a.freq, 48, y + 18, 62, 24, a.color, NAVY);
      addText(s, a.name, 122, y + 8,  400, 22, { size: 13, bold: true, color: WHITE });
      addText(s, a.desc, 122, y + 30, 550, 28, { size: 11, color: [192, 200, 220] });
    });

    addText(s, 'All agent writes go to admin_alerts table (status: pending). No autonomous external actions. Librarian approval required.', 36, 400, 648, 22, { size: 11, color: AMBER });
  }

  // ════════════════════════════════════════════════════════
  // SLIDE 8 — AI FEATURES
  // ════════════════════════════════════════════════════════
  {
    const s = addSlide();
    setBg(s, LIGHT);
    tagBar(s, '07  AI Features', BLUE);

    addText(s, 'Five capabilities. Two models. All human-in-the-loop.', 36, 50, 640, 40, { size: 24, bold: true, color: NAVY });

    const features = [
      { model: 'Nova Micro',         color: BLUE,  title: 'Book Recommendation Chatbot',  desc: 'User describes preferences → Nova Micro suggests 3 books from the live catalog. Prompt constrained — model cannot invent books.' },
      { model: 'Claude Haiku',       color: TEAL,  title: 'Loan Pattern Dashboard',        desc: 'Aggregates loans by genre / author / month. Haiku writes plain-English trend summary for librarian dashboard.' },
      { model: 'Claude Haiku',       color: GREEN, title: 'Demand Detection',              desc: '5+ holds on a book → Haiku recommends copy count + estimated cost. Librarian approves before any order is placed.' },
      { model: 'Claude Haiku',       color: AMBER, title: 'Stale Inventory Alerts',        desc: 'Books untouched 6+ months → Haiku suggests auction starting price. Book cannot be removed without explicit approval.' },
      { model: 'Haiku + Google Books', color: PURP, title: 'Series Release Tracker',      desc: 'Detects new entries via Google Books API. Haiku drafts SES email to fans of that series. Deduplication prevents repeat notifications.' },
    ];

    features.forEach((f, i) => {
      const col = i < 3 ? 0 : 1;
      const row = i < 3 ? i : i - 3;
      const x = 36 + col * 344, y = 108 + row * 92;
      addRect(s, x, y, 330, 82, WHITE);
      labelBox(s, f.model, x + 8, y + 8, 148, 20, f.color, NAVY);
      addText(s, f.title, x + 8, y + 32, 314, 20, { size: 12, bold: true, color: NAVY });
      addText(s, f.desc,  x + 8, y + 52, 314, 30, { size: 10, color: GRAY });
    });
  }

  // ════════════════════════════════════════════════════════
  // SLIDE 9 — RAI PRINCIPLES
  // ════════════════════════════════════════════════════════
  {
    const s = addSlide();
    setBg(s, NAVY);
    tagBar(s, '08  Responsible AI Principles', TEAL);

    addText(s, 'AI recommends. Humans decide.', 36, 50, 640, 40, { size: 28, bold: true, color: WHITE });

    const principles = [
      { title: 'Human-in-the-loop',              body: 'Every consequential action (order books, auction inventory, send alerts) requires explicit librarian approval. Agents write to admin_alerts only.' },
      { title: 'No hallucinated data',            body: 'Chatbot prompt is constrained to the live catalog list. The model cannot invent books, ISBNs, or authors.' },
      { title: 'No autonomous destructive writes',body: 'Agents have write access to admin_alerts only — not to the book or loan tables. Deletes and orders are human-gated.' },
      { title: 'Notification frequency limits',   body: 'Series tracker stores notification history per user per book. Same release never triggers a duplicate SES email.' },
      { title: 'Transparent AI actions',          body: 'All AI-generated alerts are labeled "AI Recommendation" in the dashboard — never presented as system decisions.' },
    ];

    principles.forEach((p, i) => {
      const y = 108 + i * 56;
      addRect(s, 36, y, 648, 48, DKBLU);
      addText(s, p.title, 50, y + 6, 220, 20, { size: 12, bold: true, color: TEAL });
      addText(s, p.body, 50, y + 26, 624, 20, { size: 11, color: [192, 200, 220] });
    });
  }

  // ════════════════════════════════════════════════════════
  // SLIDE 10 — SENIOR ARCHITECT CONSIDERATIONS
  // ════════════════════════════════════════════════════════
  {
    const s = addSlide();
    setBg(s, LIGHT);
    tagBar(s, '09  Senior Architect Considerations', PURP);

    addText(s, 'What could go wrong — and how it\'s designed against.', 36, 50, 640, 40, { size: 22, bold: true, color: NAVY });

    const items = [
      { risk: 'Race condition\n(last copy)',  fix: 'DynamoDB conditional write: ConditionExpression: availableCopies > 0 → returns 409 if fails. First request wins.' },
      { risk: 'Checkout\natomicity',          fix: 'TransactWriteItems — decrement copies + create loan record are one atomic operation. No partial state.' },
      { risk: 'Idempotent\ncheckout',         fix: 'Client sends UUID idempotency key per attempt. Lambda checks for existing loan before processing.' },
      { risk: 'Search / DB\ndrift',           fix: 'DLQ on Stream processor Lambda. CloudWatch alarm on DLQ depth. Manual re-index Lambda available.' },
      { risk: 'availableCopies\ndrift',       fix: 'Weekly reconciliation Lambda counts active loans vs counter. Mismatches surface as admin alerts — never auto-corrected.' },
      { risk: 'Observability',                fix: 'Structured logging + correlation ID per request. CloudWatch alarms: error rate, p99 latency, DLQ depth.' },
    ];

    items.forEach((item, i) => {
      const y = 105 + i * 48;
      addRect(s, 36, y, 170, 42, [240, 232, 252]);
      addText(s, item.risk, 44, y + 4, 158, 36, { size: 11, bold: true, color: PURP });
      addRect(s, 210, y, 474, 42, WHITE);
      addText(s, item.fix, 218, y + 6, 460, 32, { size: 11, color: NAVY });
    });
  }

  // ════════════════════════════════════════════════════════
  // SLIDE 11 — CLOSING
  // ════════════════════════════════════════════════════════
  {
    const s = addSlide();
    setBg(s, NAVY);
    addRect(s, 0, 0, 7, 405, TEAL);

    addText(s, 'Built to production standards.', 40, 80, 640, 60, { size: 32, bold: true, color: WHITE });
    addText(s, 'Serverless from day one. AI where it earns its place.\nHumans in control of every consequential action.', 40, 154, 620, 68, { size: 17, color: [160, 200, 240] });

    const checks = [
      'React + TypeScript frontend',
      'AWS Lambda + API Gateway',
      'DynamoDB single-table design',
      'Claude Haiku + Nova Micro on Bedrock',
      'EventBridge scheduled agents',
      'SES email notifications',
      'Google OAuth + JWT auth',
    ];
    checks.forEach((b, i) => {
      const col = i < 4 ? 0 : 1;
      const row = i < 4 ? i : i - 4;
      addText(s, '✓  ' + b, 40 + col * 334, 250 + row * 32, 310, 28, { size: 12, color: TEAL });
    });

    addText(s, 'sindhujakalisrinivasan@gmail.com', 40, 375, 640, 24, { size: 11, color: GRAY });
  }

  Logger.log('Presentation URL: ' + pres.getUrl());
}
