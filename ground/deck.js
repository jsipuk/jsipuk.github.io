/* The Dojo — the seeded deck.
 *
 * Deliberately vendor neutral. Every card is about craft: how you think,
 * sequence and hold a conversation. Nothing here asserts a product capability,
 * a competitor gap or a statistic, because those go stale and because a
 * practice tool that trains you to repeat an unverified claim is worse than no
 * practice tool. Product specifics belong in your own kept answers and in the
 * cards you add yourself, where you can check them.
 *
 * shape = the structure of a good answer, not the answer itself.
 * watch = the failure mode this card exists to train out of you.
 *
 * To add a permanent card, append to DECK below and bump CACHE in sw.js.
 * To add one on the fly, use "Add a card" in the app: those live in your own
 * encrypted store and travel with your export.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DojoDeck = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CATS = {
    discovery:   {label:'Discovery',   colour:'#a89dff'},
    objection:   {label:'Objection',   colour:'#fb7185'},
    exec:        {label:'Executive',   colour:'#38bdf8'},
    technical:   {label:'Technical',   colour:'#4ade80'},
    competitive: {label:'Competitive', colour:'#f472b6'},
    pov:         {label:'Evaluation',  colour:'#fbbf24'},
    process:     {label:'Deal craft',  colour:'#94a3b8'}
  };
  
  const DECK = [
    /* ---- Discovery ---- */
    {id:'d1', cat:'discovery',
     prompt:'You have twenty minutes with a CISO you have never met. What are your first three questions?',
     setting:'They agreed to the call as a favour to someone. They are half in the room.',
     shape:['Open on their world, not your product: what is changing for them this year.','Find the forcing function: what has a date attached to it.','Find the cost of doing nothing, in their words.'],
     watch:'Three questions that are really one pitch with question marks on the end.'},
  
    {id:'d2', cat:'discovery',
     prompt:'Your champion says "we want SASE". What do you ask to find out what they actually mean?',
     setting:'They have used the word four times and defined it zero times.',
     shape:['Ask what prompted the term: a board slide, an analyst, a peer, a renewal.','Ask which problem disappears first if it works.','Ask who else has to agree with the definition.'],
     watch:'Accepting the acronym as a requirement. It is almost never the requirement.'},
  
    {id:'d3', cat:'discovery',
     prompt:'How do you find out who really signs, without asking who signs?',
     setting:'You are on a call with three people and one of them is quiet.',
     shape:['Ask how the last comparable purchase actually got approved.','Ask what would need to be true for this to survive a budget review.','Ask who would be unhappy if this went ahead.'],
     watch:'Taking the most senior title in the room as the decision maker.'},
  
    {id:'d4', cat:'discovery',
     prompt:'A prospect says everything is fine and they are just looking. What now?',
     setting:'Genuinely no pain on the table. Fifteen minutes left.',
     shape:['Believe them out loud. Stop selling, visibly.','Ask what would have to break for this to become urgent.','Offer one thing worth their time regardless of outcome, and leave.'],
     watch:'Manufacturing urgency. They can hear it and it costs you the next call.'},
  
    {id:'d5', cat:'discovery',
     prompt:'The technical team is enthusiastic and the business is absent. Diagnose the risk out loud to your AE.',
     setting:'Two good labs done. No executive has ever joined a call.',
     shape:['Name it plainly: no business sponsor, no budget event.','Say what specifically is missing, not that it "feels risky".','Propose the smallest action that tests it this week.'],
     watch:'Mistaking technical enthusiasm for a deal.'},
  
    {id:'d6', cat:'discovery',
     prompt:'Ask a question that would make a stranger tell you something they were not planning to say.',
     setting:'Any account, any stage.',
     shape:['Make it specific enough to be answerable and open enough to be interesting.','Ask about a decision, not a fact.','Then say nothing at all.'],
     watch:'Filling the silence. The silence is the question.'},
  
    /* ---- Objection ---- */
    {id:'o1', cat:'objection',
     prompt:'"We already have a VPN and it works fine. Why would we change?"',
     setting:'Network lead, arms folded, has run that VPN for nine years.',
     shape:['Agree that it works, honestly, for what it was built to do.','Move the ground from performance to what the estate looks like now.','One concrete difference in behaviour, not a feature list.','Ask what would have to be true to look again.'],
     watch:'Implying they made a bad decision. They did not, in 2016.'},
  
    {id:'o2', cat:'objection',
     prompt:'"We tried DLP before. It produced thousands of false positives and we switched it off."',
     setting:'They are not bluffing. It genuinely happened.',
     shape:['Take the scar seriously and ask what the rollout looked like.','Separate the tool from the approach that failed.','Say what you would do differently, specifically.','Agree a definition of acceptable noise before anything is turned on.'],
     watch:'Answering with accuracy claims. They have heard accuracy claims before.'},
  
    {id:'o3', cat:'objection',
     prompt:'"Your competitor is thirty percent cheaper for what looks like the same thing."',
     setting:'Procurement is on the call. Your champion has gone quiet.',
     shape:['Do not discount in the room and do not flinch.','Ask what is in each scope, out loud, line by line.','Name where the difference genuinely is, including where it is not.','Hand the comparison back as something they own.'],
     watch:'Defending price. Make the scope the subject, not the number.'},
  
    {id:'o4', cat:'objection',
     prompt:'"We are a Microsoft shop. Why would we not just use what is already included?"',
     setting:'Fair question. Partly true. Asked without hostility.',
     shape:['Concede the genuine overlap immediately and specifically.','Move to where the boundary sits in their estate.','Name what they would still have to solve, and let them check it.'],
     watch:'Pretending there is no overlap. It destroys everything you say next.'},
  
    {id:'o5', cat:'objection',
     prompt:'"Inline inspection will slow everyone down and break our applications."',
     setting:'Architect who has been burned by an inline proxy before.',
     shape:['Take the concern as legitimate engineering, not resistance.','Separate the two claims: latency and breakage. They have different answers.','Say how each would be measured in their environment.','Offer the test before the assurance.'],
     watch:'Reassurance without a measurement. It sounds like marketing.'},
  
    {id:'o6', cat:'objection',
     prompt:'"Our users will not accept us decrypting their traffic."',
     setting:'Works council, privacy officer, or a genuinely principled engineer.',
     shape:['Treat it as a legitimate position, because it is.','Separate what is technically possible from what they should choose.','Talk about scope, exclusions and transparency before capability.','Ask who needs to be comfortable, and what would make them comfortable.'],
     watch:'Winning the technical argument and losing the room.'},
  
    {id:'o7', cat:'objection',
     prompt:'"We cannot deploy agents on contractor or unmanaged devices."',
     setting:'Real constraint, not an excuse. Thousands of them.',
     shape:['Accept the constraint as fixed, do not negotiate it.','Split the population and handle each honestly.','Be explicit about what is weaker in the agentless path.'],
     watch:'Overstating what you can do without an agent, which the POV will expose.'},
  
    {id:'o8', cat:'objection',
     prompt:'"We signed a three year deal with your competitor eight months ago."',
     setting:'Nothing you can do about it. They still took the meeting.',
     shape:['Say the obvious thing: you are not asking them to rip it out.','Ask why they took the call, and listen properly to the answer.','Find the gap that will still be there at renewal.','Agree a reason to talk again with a date on it.'],
     watch:'Leaving without a next step because there is no deal this year.'},
  
    {id:'o9', cat:'objection',
     prompt:'"What happens when your service is unreachable?"',
     setting:'Asked flatly, in front of their whole team.',
     shape:['Answer the failure mode directly and first.','Describe the behaviour, not the availability figure.','Say what they can configure and what they cannot.','Offer to test the failure path in the evaluation.'],
     watch:'Reaching for an uptime number. They asked what happens, not how often.'},
  
    {id:'o10', cat:'objection',
     prompt:'"How do we know you will not be acquired, or drop this product line?"',
     setting:'A CIO who has been through two acquisitions of their suppliers.',
     shape:['Do not promise anything about the future you cannot know.','Talk about what protects them contractually and architecturally.','Talk about what an exit would actually cost them, honestly.'],
     watch:'Any sentence that starts "that would never happen".'},
  
    {id:'o11', cat:'objection',
     prompt:'"Prove our data never leaves our region."',
     setting:'Regulated. Their legal team will read your answer.',
     shape:['Separate the classes: traffic, metadata, logs, telemetry, support access.','Answer each precisely, including where you are unsure.','Say what you will confirm in writing and by when.'],
     watch:'A confident single sentence. This question has five different answers.'},
  
    {id:'o12', cat:'objection',
     prompt:'"You are a collection of acquired products with one badge on the front."',
     setting:'The incumbent planted it. Your champion is repeating it.',
     shape:['Do not get defensive and do not attack the source.','Turn it into something testable rather than a claim war.','Name the specific seams they should go and check.','Let the evaluation answer it instead of you.'],
     watch:'Answering an architecture jibe with an architecture speech. Give them a test.'},
  
    /* ---- Executive ---- */
    {id:'e1', cat:'exec',
     prompt:'The CFO asks: "If I buy this, what do I stop paying for?"',
     setting:'Thirty seconds. They will not ask twice.',
     shape:['Answer the actual question first, with what genuinely goes.','Be honest about what does not go, and what runs in parallel for a while.','Give the timing, because that is the real question.'],
     watch:'A benefits answer to a cost question. They will notice.'},
  
    {id:'e2', cat:'exec',
     prompt:'The board asks: "Are we more or less exposed than our peers?"',
     setting:'You have thirty seconds and no benchmark data you can defend.',
     shape:['Refuse the false precision gracefully.','Reframe to what you can speak to: what is visible and what is not.','Give them one question to ask their own team on Monday.'],
     watch:'Inventing a comparison. It is the fastest way to lose a boardroom.'},
  
    {id:'e3', cat:'exec',
     prompt:'Explain zero trust to a non-technical executive in thirty seconds, without using the words "zero trust".',
     setting:'They are polite, busy, and have heard the phrase forty times.',
     shape:['One sentence about what changed in how people work.','One sentence about what the old assumption was.','One sentence about what you check instead, in plain words.'],
     watch:'Any jargon at all. Ban the acronyms and see what is left.'},
  
    {id:'e4', cat:'exec',
     prompt:'Turn a technical finding from a trial into one sentence a CIO would repeat to their board.',
     setting:'You found a real problem in week two. It is technical and it is dull.',
     shape:['Lead with the consequence, not the mechanism.','Quantify it in their units: people, money, time, exposure.','Make it repeatable by someone who does not understand the detail.'],
     watch:'A sentence that only works if the listener already understands the technology.'},
  
    {id:'e5', cat:'exec',
     prompt:'A sponsor asks what could go wrong with this project. Answer as though you want them to trust you in a year.',
     setting:'They are about to put their name on it.',
     shape:['Name the two real risks before they do.','Say which one you have seen actually happen.','Say what you would do to catch it early.'],
     watch:'Minimising. The sponsor is testing whether you are safe to rely on.'},
  
    /* ---- Technical ---- */
    {id:'t1', cat:'technical',
     prompt:'Whiteboard how a user reaches a private application without a VPN. Talk it through as you draw.',
     setting:'Two network engineers watching closely.',
     shape:['Start with the user and the app, and nothing in the middle.','Add only what you need, naming each thing as you add it.','Be explicit about where the decision happens and where enforcement happens.','Stop and check before adding the next layer.'],
     watch:'Drawing the vendor architecture instead of their traffic flow.'},
  
    {id:'t2', cat:'technical',
     prompt:'Explain the difference between where policy is decided and where it is enforced, to someone who thinks it is the same box.',
     setting:'It matters here because their estate has four enforcement points.',
     shape:['Use one concrete request as the example.','Walk the request, saying what is known at each step.','Show what breaks when the decision has the wrong context.'],
     watch:'Abstraction. Use one real request, end to end.'},
  
    {id:'t3', cat:'technical',
     prompt:'Explain to a security engineer why an API scan and inline inspection are not the same control.',
     setting:'They believe one replaces the other. They are half right.',
     shape:['Give the point in time each one acts.','Give one thing each catches that the other cannot.','Say plainly where they overlap and where you would use both.'],
     watch:'Selling both instead of explaining both.'},
  
    {id:'t4', cat:'technical',
     prompt:'Explain data classification to someone who believes a regular expression is enough.',
     setting:'They have built regex rules for eight years and they work, mostly.',
     shape:['Give them the credit: for structured identifiers, they are largely right.','Show the case where it falls over, with a real example.','Say what you would add rather than what you would replace.'],
     watch:'Dismissing what they built. They will stop listening.'},
  
    {id:'t5', cat:'technical',
     prompt:'A customer asks you something you genuinely do not know, in front of eight people.',
     setting:'You have a plausible guess. It is only a guess.',
     shape:['Say you do not know, immediately and without apology.','Say what you do know that is adjacent.','Commit to who will answer and by when, then write it down visibly.'],
     watch:'The plausible guess. It is the single most expensive habit in this job.'},
  
    {id:'t6', cat:'technical',
     prompt:'Explain how you would size and stage a rollout for forty thousand users across nine countries.',
     setting:'Asked casually, over lunch, by the person who will own it.',
     shape:['Ask two questions before answering: what is fixed, and what is first.','Stage by risk and reversibility, not by geography.','Name the checkpoint where you would stop and reassess.'],
     watch:'A confident plan built on assumptions you never stated.'},
  
    /* ---- Competitive ---- */
    {id:'c1', cat:'competitive',
     prompt:'The competitor demoed something you do not have. The customer saw it and liked it.',
     setting:'They ask you directly, in the room.',
     shape:['Confirm what is true without hedging.','Ask what they would use it for, and how often.','Address the underlying job, or concede it cleanly.','Move to ground where the comparison is yours.'],
     watch:'Casting doubt on whether they really saw it. It always backfires.'},
  
    {id:'c2', cat:'competitive',
     prompt:'You genuinely lose on one requirement that matters to them. Handle it out loud.',
     setting:'It is a real gap. They will find it anyway.',
     shape:['Say it before they do. The timing is the whole answer.','Be precise about the boundary of the gap.','Show what the workaround costs, honestly.','Ask how it weighs against the rest, and accept the answer.'],
     watch:'Burying it and hoping. Being second and honest beats first and caught.'},
  
    {id:'c3', cat:'competitive',
     prompt:'Their evaluation criteria were clearly written by your competitor. Respond without saying so.',
     setting:'Sixty requirements. Eleven are suspiciously specific.',
     shape:['Do not name what has happened. Everyone knows.','Ask what outcome sits behind three of the oddly specific ones.','Offer to help them add the criteria they are missing.','Compete on the criteria, not on the criteria being unfair.'],
     watch:'Complaining. It reads as losing.'},
  
    {id:'c4', cat:'competitive',
     prompt:'Say why you would win here, in two sentences, to your own manager. Then say why you might lose.',
     setting:'Forecast call. They want the truth, not the pipeline story.',
     shape:['Lead with the reason that is about them, not about you.','Give the loss reason with equal specificity.','Say what would change your confidence either way.'],
     watch:'A win reason that is a feature and a loss reason that is "price".'},
  
    /* ---- Evaluation / POV ---- */
    {id:'p1', cat:'pov',
     prompt:'Write three success criteria for an evaluation that you could genuinely fail.',
     setting:'Four weeks. They asked you to propose the criteria.',
     shape:['Each one measurable by them without your help.','Each one with a threshold agreed before you start.','At least one where failure is a real possibility.'],
     watch:'Criteria you know you pass. They prove nothing and everyone knows it.'},
  
    {id:'p2', cat:'pov',
     prompt:'They want to test forty things in four weeks. Cut it down, in the room, without losing the deal.',
     setting:'The list came from six different teams.',
     shape:['Ask which three would change the decision if they failed.','Group the rest as documented or deferred, visibly not deleted.','Get agreement that the three are decisive.'],
     watch:'Agreeing to all forty to seem accommodating, then failing slowly.'},
  
    {id:'p3', cat:'pov',
     prompt:'Week three. Usage has collapsed. Nobody has said anything. What do you do?',
     setting:'The champion is still friendly and still busy.',
     shape:['Raise it yourself, early, with the data in front of you.','Ask what changed rather than why they stopped.','Offer a reduced scope that can still finish honestly.','Agree what happens if it does not recover.'],
     watch:'Waiting politely. A quiet evaluation is a failing one.'},
  
    {id:'p4', cat:'pov',
     prompt:'The evaluation passed technically and the deal is not moving. Diagnose it out loud.',
     setting:'Everything you controlled went well.',
     shape:['Separate technical validation from commercial permission.','Name what was never established: sponsor, budget event, or consequence.','Propose the one conversation that would tell you which.'],
     watch:'Doing more technical work. It is not a technical problem.'},
  
    {id:'p5', cat:'pov',
     prompt:'Something broke during the evaluation and it was your fault. Open the next call.',
     setting:'They lost half a day. They are annoyed and polite.',
     shape:['Lead with it. Do not let it come up in question five.','Say what happened in plain terms, no passive voice.','Say what you changed so it cannot recur.','Then, and only then, move on.'],
     watch:'"There were some issues." Own it in the active voice.'},
  
    /* ---- Deal craft ---- */
    {id:'x1', cat:'process',
     prompt:'You promised something in a call that the product cannot do. What do you do next?',
     setting:'You realised an hour later. Nobody has noticed yet.',
     shape:['Correct it in writing today, to everyone who was there.','State what is actually true and what you got wrong.','Offer the nearest real alternative.','Do not wait to be caught.'],
     watch:'Hoping it never comes up. It always comes up, at the worst moment.'},
  
    {id:'x2', cat:'process',
     prompt:'Your AE wants you to demo a roadmap feature as though it ships today. Handle it, with them.',
     setting:'They are under quota pressure and they are not a bad person.',
     shape:['Say what you will do rather than what you refuse.','Offer the honest version: show it, label it, date it.','Name the specific downside for them, not the principle.'],
     watch:'Making it about ethics. Make it about what happens in month four.'},
  
    {id:'x3', cat:'process',
     prompt:'The deal has been stuck in procurement for five weeks. What is your move as the SE, not the AE?',
     setting:'Technical work is finished. You feel powerless.',
     shape:['Find the technical question still open inside the delay, if there is one.','Give the champion something that makes their internal case easier.','Keep the relationship warm without chasing the deal.'],
     watch:'Chasing. It is not your lever and it damages the one you have.'},
  
    {id:'x4', cat:'process',
     prompt:'A customer asks you, privately, whether they should buy your product. Answer honestly.',
     setting:'They trust you. That is exactly why they asked.',
     shape:['Answer as though you will still know them in five years.','Say what it is genuinely good for, and what it is not.','Name the condition under which you would say no.'],
     watch:'The sales answer. It is the one moment where it costs the most.'},
  
    {id:'x5', cat:'process',
     prompt:'Name the objection you handle worst. Then write the answer you wish you had given last time.',
     setting:'No audience. Just you, being honest.',
     shape:['Pick the real one, not a convenient one.','Write what you actually said, first.','Then write the version with the concession moved to the front.'],
     watch:'Choosing an easy card. This one only works if it stings.'},
  
    {id:'x6', cat:'process',
     prompt:'Give the thirty second version of what you do, to someone at a school gate.',
     setting:'They are being polite. You have one shot at being interesting.',
     shape:['No acronyms, no company names, no job title.','One concrete thing you did this month.','Stop before they need to be polite again.'],
     watch:'The job description. Nobody has ever been interested in a job description.'}
  ];

  return { CATS: CATS, DECK: DECK };
}));
