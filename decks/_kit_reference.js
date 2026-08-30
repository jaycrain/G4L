const pptxgen = require("pptxgenjs");
const p = new pptxgen();
p.layout = "LAYOUT_WIDE";
const RINGS = require("path").join(__dirname, "rings_transparent.png");
const STRIPE = require("path").join(__dirname, "stripe_band.png");
const WORDMARK = require("path").join(__dirname, "wordmark_navy.png");
const NAVY="374F63", TEAL="3B9495", TEALD="2F7A7B", ORANGE="EC6233", OLIVE="919536", RED="BB2127",
      BODY="3A434B", GREY="5B636B", GREYL="8A929A", LGREY="E8E6E6", OFF="F3F4F5", WHITE="FFFFFF";
const HEAD="Barlow", COND="Barlow Condensed";
const rect=p.ShapeType.rect, rr=p.ShapeType.roundRect, oval=p.ShapeType.ellipse;
function stripes(s){s.addImage({path:STRIPE,x:0,y:7.15,w:13.333,h:0.35});}
function wordmark(s,white){s.addImage({path:WORDMARK,x:0.5,y:6.58,w:1.1,h:0.523});}
function pageno(s,n){s.addText(String(n),{x:12.25,y:0.3,w:0.75,h:0.32,fontFace:HEAD,color:GREYL,fontSize:13,align:"right",margin:0});}
function chrome(s,n,white){stripes(s);wordmark(s,white);if(n)pageno(s,n);}
function title(s,t,dek){s.addText(t,{x:0.55,y:0.42,w:11.5,h:0.7,fontFace:HEAD,bold:true,color:NAVY,fontSize:32,align:"left",margin:0});if(dek)s.addText(dek,{x:0.57,y:1.12,w:11.8,h:0.4,fontFace:HEAD,color:GREY,fontSize:17,align:"left",margin:0});}
function dot(s,x,y,d,color,label){s.addShape(oval,{x,y,w:d,h:d,fill:{color},line:{width:0}});s.addText(String(label),{x,y:y-0.005,w:d,h:d,fontFace:HEAD,bold:true,color:WHITE,fontSize:16,align:"center",valign:"middle",margin:0});}

let s=p.addSlide();s.background={color:WHITE};
s.addImage({path:RINGS,x:9.0,y:1.55,w:3.25,h:3.25});
s.addText("A SHORT GUIDE BEFORE YOU START",{x:0.7,y:2.4,w:7.6,h:0.35,fontFace:HEAD,bold:true,color:TEAL,fontSize:14,charSpacing:2,align:"left",margin:0});
s.addText("Beginning Your Comeback",{x:0.66,y:2.78,w:8.0,h:1.5,fontFace:HEAD,bold:true,color:NAVY,fontSize:40,align:"left",margin:0});
s.addText("What to bring, and how to begin.",{x:0.7,y:4.35,w:7.6,h:0.5,fontFace:HEAD,color:GREY,fontSize:22,align:"left",margin:0});
s.addText("July 29, 2026   ·   For our team and founding Charter members   ·   Confidential",{x:0.7,y:5.05,w:7.8,h:0.35,fontFace:HEAD,italic:true,color:GREYL,fontSize:13,align:"left",margin:0});
s.addText("© 2026 Adjacent Lab, LLC",{x:9.6,y:6.86,w:3.2,h:0.3,fontFace:HEAD,color:GREYL,fontSize:11,align:"right",margin:0});
chrome(s,null,false);

s=p.addSlide();s.background={color:WHITE};
title(s,"This is a Comeback.","What Grinta for Life asks of you — and gives back.");
s.addText([{text:"Grinta for Life is a Comeback — the work of closing the gap between who you are right now and who you still are underneath. ",options:{}},{text:"The Fade",options:{bold:true}},{text:" is how that gap opened. ",options:{}},{text:"The Companion, the Sessions, and the Program",options:{bold:true}},{text:" are how you close it. Give it real time and it gives real change back.",options:{}}],{x:0.6,y:1.95,w:7.6,h:2.2,fontFace:HEAD,color:BODY,fontSize:18,align:"left",valign:"top",lineSpacingMultiple:1.12,margin:0});
const spine=[["The Fade","the problem",NAVY],["The work","the means",TEAL],["Your Comeback","the outcome",ORANGE]];
spine.forEach((it,i)=>{const x=0.6+i*2.6,cy=4.35;s.addShape(rr,{x,y:cy,w:2.35,h:0.95,rectRadius:0.09,fill:{color:it[2]},line:{width:0}});s.addText([{text:it[0],options:{bold:true,fontSize:15,breakLine:true}},{text:it[1],options:{fontSize:11.5,italic:true}}],{x,y:cy,w:2.35,h:0.95,fontFace:HEAD,color:WHITE,align:"center",valign:"middle",lineSpacingMultiple:1.0,margin:0});if(i<2)s.addText("→",{x:x+2.33,y:cy,w:0.3,h:0.95,fontFace:HEAD,bold:true,color:GREYL,fontSize:18,align:"center",valign:"middle",margin:0});});
s.addShape(rr,{x:8.55,y:1.95,w:4.2,h:2.55,rectRadius:0.12,fill:{color:TEAL},line:{width:0}});
s.addText([{text:"Settle in.",options:{bold:true,fontSize:20,breakLine:true,paraSpaceAfter:8}},{text:"This is a practice you return to, measured over weeks — not a five-minute experience. The more honest and detailed you are, the better it knows you.",options:{fontSize:15.5}}],{x:8.85,y:2.2,w:3.6,h:2.1,fontFace:HEAD,color:WHITE,align:"left",valign:"top",lineSpacingMultiple:1.12,margin:0});
chrome(s,2,false);

s=p.addSlide();s.background={color:WHITE};
title(s,"Why it works this way.","A good guide draws the answers out of you — and trusts you to lead.");
s.addShape(rr,{x:0.6,y:1.7,w:12.13,h:1.4,rectRadius:0.12,fill:{color:NAVY},line:{width:0}});
s.addText([{text:"The Companion asks; it never lectures.  ",options:{bold:true}},{text:"It draws your own answers out of you and reflects them back, so you hear yourself. No grading, no fixing, no judgment — you're the only expert on your own life, which is exactly why it's safe to be honest here.",options:{}}],{x:0.95,y:1.7,w:11.4,h:1.4,fontFace:HEAD,color:WHITE,fontSize:15.5,align:"left",valign:"middle",lineSpacingMultiple:1.12,margin:0});
s.addText("And that posture is deliberate. Change only lasts when it's truly yours — so the program is built to give you three things:",{x:0.62,y:3.28,w:12.1,h:0.45,fontFace:HEAD,italic:true,color:GREY,fontSize:15,align:"left",margin:0});
const needs=[["It's yours.","Your goals, your pace, your words. When the reasons are your own, the change holds when life pushes back.",NAVY],["You feel it move.","Small, real wins you can see. A slip is part of the work, not a failure — so you reset and keep going.",TEAL],["You're not alone.","A Companion that remembers you, a Community that's been where you are. Being seen is part of how people change.",OLIVE]];
needs.forEach((c,i)=>{const x=0.6+i*4.13;s.addShape(rr,{x,y:3.9,w:3.85,h:2.45,rectRadius:0.12,fill:{color:OFF},line:{color:LGREY,width:1}});s.addText(c[0],{x:x+0.3,y:4.18,w:3.25,h:0.5,fontFace:HEAD,bold:true,color:c[2],fontSize:19,align:"left",margin:0});s.addText(c[1],{x:x+0.3,y:4.74,w:3.25,h:1.55,fontFace:HEAD,color:BODY,fontSize:14,align:"left",valign:"top",lineSpacingMultiple:1.12,margin:0});});
chrome(s,3,false);

s=p.addSlide();s.background={color:WHITE};
title(s,"It's safe to be honest.","The work only holds if you tell the truth — so here's how that's protected.");
s.addShape(rr,{x:0.6,y:1.68,w:12.13,h:1.15,rectRadius:0.12,fill:{color:NAVY},line:{width:0}});
s.addText("“This conversation is guided by AI. Everything you share shapes your G4L experience and is handled with the same care you’d expect from a person. You can stop at any time.”",{x:0.95,y:1.68,w:11.4,h:1.15,fontFace:HEAD,italic:true,color:WHITE,fontSize:16,align:"left",valign:"middle",lineSpacingMultiple:1.1,margin:0});
const trust=[["Always disclosed.","You always know when you're talking to the Companion. It never poses as a person.",NAVY],["Yours alone.","What you share shapes your experience and nothing else — it isn't used to train AI.",TEAL],["Nothing to perform for.","The Companion carries no social stake, which is what makes it a place to be honest — and a bridge back to real people.",OLIVE]];
trust.forEach((c,i)=>{const x=0.6+i*4.13;s.addShape(rr,{x,y:3.05,w:3.85,h:2.5,rectRadius:0.12,fill:{color:OFF},line:{color:LGREY,width:1}});s.addText(c[0],{x:x+0.3,y:3.3,w:3.25,h:0.5,fontFace:HEAD,bold:true,color:c[2],fontSize:18,align:"left",margin:0});s.addText(c[1],{x:x+0.3,y:3.85,w:3.25,h:1.55,fontFace:HEAD,color:BODY,fontSize:13.5,align:"left",valign:"top",lineSpacingMultiple:1.12,margin:0});});
s.addText("A safety net runs underneath it all — if things ever turn dark, the Companion connects you to real help right away, including the 988 Suicide & Crisis Lifeline.",{x:0.62,y:5.78,w:12.1,h:0.5,fontFace:HEAD,italic:true,color:GREYL,fontSize:12.5,align:"left",valign:"top",lineSpacingMultiple:1.1,margin:0});
chrome(s,4,false);

s=p.addSlide();s.background={color:WHITE};
title(s,"The mindset to bring.","Five things to carry in.");
const mind=[["Be honest with yourself.","This works to the degree you tell it the truth — including the parts you'd rather skip. It's a private space built for exactly that.",NAVY],["Give it detail.","The more you tell the Companion, the better it knows you and the more it can help. Full answers, in your own words, go a long way.",TEAL],["Slow down.","The Sessions are conversations. Sit with the questions; there's no clock.",OLIVE],["Be present.","Some of it will stir things up. That's the work landing.",ORANGE],["Come back.","The value compounds across days and weeks. One honest sitting starts it; returning builds it.",RED]];
mind.forEach((m,i)=>{const y=1.75+i*1.02;dot(s,0.6,y+0.06,0.5,m[2],i+1);s.addText(m[0],{x:1.35,y,w:11.3,h:0.36,fontFace:HEAD,bold:true,color:NAVY,fontSize:17.5,align:"left",margin:0});s.addText(m[1],{x:1.35,y:y+0.35,w:11.3,h:0.6,fontFace:HEAD,color:BODY,fontSize:14,align:"left",valign:"top",lineSpacingMultiple:1.05,margin:0});});
chrome(s,5,false);

s=p.addSlide();s.background={color:WHITE};
title(s,"Set yourself up.","A little prep makes the first sitting land.");
const prep=[["Somewhere private","A quiet hour where you can be honest — out loud or in writing."],["Start on desktop","The Dashboard is built for a bigger screen — start there. Your phone is great for checking in later."],["Three things in mind","Who you were before the Fade, what changed, and what you'd want back. You'll put words to all of it as you go."]];
prep.forEach((c,i)=>{const x=0.6+i*4.13;s.addShape(rr,{x,y:2.0,w:3.85,h:3.4,rectRadius:0.12,fill:{color:OFF},line:{color:LGREY,width:1}});s.addShape(oval,{x:x+0.32,y:2.35,w:0.62,h:0.62,fill:{color:[NAVY,TEAL,ORANGE][i]},line:{width:0}});s.addText(String(i+1),{x:x+0.32,y:2.34,w:0.62,h:0.62,fontFace:HEAD,bold:true,color:WHITE,fontSize:18,align:"center",valign:"middle",margin:0});s.addText(c[0],{x:x+0.32,y:3.2,w:3.25,h:0.5,fontFace:HEAD,bold:true,color:NAVY,fontSize:19,align:"left",margin:0});s.addText(c[1],{x:x+0.32,y:3.75,w:3.25,h:1.5,fontFace:HEAD,color:BODY,fontSize:14.5,align:"left",valign:"top",lineSpacingMultiple:1.12,margin:0});});
chrome(s,6,false);

s=p.addSlide();s.background={color:WHITE};
title(s,"How to get in.","One link, any device — installable like an app.");
s.addShape(rr,{x:0.6,y:1.95,w:12.13,h:1.0,rectRadius:0.12,fill:{color:TEAL},line:{width:0}});
s.addText([{text:"Open in your browser:   ",options:{fontSize:16}},{text:"https://g4l-ten.vercel.app",options:{bold:true,fontSize:22,color:"FFFFFF",underline:{style:"sng"},hyperlink:{url:"https://g4l-ten.vercel.app"}}}],{x:0.95,y:1.95,w:11.4,h:1.0,fontFace:HEAD,color:WHITE,align:"left",valign:"middle",margin:0});
s.addText("Grinta for Life is a Progressive Web App (PWA): it runs in any modern browser, and you can install it to your home screen for a full-screen, app-like experience with reminders. Sign up with your own email — each account is private to one person.",{x:0.62,y:3.12,w:12.1,h:0.95,fontFace:HEAD,color:BODY,fontSize:15,align:"left",valign:"top",lineSpacingMultiple:1.1,margin:0});
const dev=[["Desktop browser","Open the link in Chrome, Safari, or Edge. The best place for your Sessions — the biggest canvas.",NAVY],["iPad","Open in Safari, then Share → Add to Home Screen for a full-screen app.",TEAL],["iPhone","Open in Safari, Share → Add to Home Screen. Installing turns on reminders (iOS 16.4+).",OLIVE],["Android","Open in Chrome, tap Install app / Add to Home Screen. Full app, with reminders.",ORANGE]];
dev.forEach((d,i)=>{const x=0.6+i*3.06;s.addShape(rr,{x,y:4.15,w:2.85,h:2.35,rectRadius:0.1,fill:{color:OFF},line:{color:LGREY,width:1}});s.addText(d[0],{x:x+0.26,y:4.5,w:2.4,h:0.45,fontFace:HEAD,bold:true,color:d[2],fontSize:17,align:"left",margin:0});s.addText(d[1],{x:x+0.26,y:5.02,w:2.4,h:1.35,fontFace:HEAD,color:BODY,fontSize:12.5,align:"left",valign:"top",lineSpacingMultiple:1.1,margin:0});});
chrome(s,7,false);

s=p.addSlide();s.background={color:WHITE};
title(s,"Your first sitting.","Four steps, in order. Don't rush them.");
const steps=[["Onboarding","A real conversation where you name your identity, your Fade, the Doors it came through, and what you want to reclaim. It's the foundation everything stands on — give it your honest best.",NAVY],["The Threshold Ceremony","Your first arrival on the Dashboard. Let it land; it marks the start.",TEAL],["The Tour","A quick orientation to the pieces — re-runnable anytime from the Field Guide.",OLIVE],["Settle in with the Companion","Talk to it on the Dashboard. Ask it things. Feel the fact that it remembers you.",ORANGE]];
steps.forEach((m,i)=>{const y=1.72+i*1.08;dot(s,0.6,y+0.04,0.52,m[2],i+1);s.addText(m[0],{x:1.38,y,w:11.3,h:0.36,fontFace:HEAD,bold:true,color:NAVY,fontSize:17.5,align:"left",margin:0});s.addText(m[1],{x:1.38,y:y+0.36,w:11.2,h:0.66,fontFace:HEAD,color:BODY,fontSize:14,align:"left",valign:"top",lineSpacingMultiple:1.05,margin:0});});
s.addText("That's a full first sitting. Stopping here and coming back is fine.",{x:1.38,y:6.15,w:11.0,h:0.4,fontFace:HEAD,italic:true,color:TEALD,fontSize:14.5,align:"left",margin:0});
chrome(s,8,false);

s=p.addSlide();s.background={color:WHITE};
title(s,"Your first Session: the Doors.","Where the Companion starts to really know you.");
s.addText([{text:"When you're ready, start the ",options:{}},{text:"Doors",options:{bold:true}},{text:" — your first real Session. You'll go deeper on the doors your Fade came through. Most of us walked through more than one: a career that ended, a body that started saying no, a marriage that drifted, a loss that changed everything.",options:{}}],{x:0.6,y:2.0,w:7.5,h:2.0,fontFace:HEAD,color:BODY,fontSize:18,align:"left",valign:"top",lineSpacingMultiple:1.14,margin:0});
s.addShape(rr,{x:0.6,y:4.35,w:7.5,h:1.35,rectRadius:0.12,fill:{color:TEAL},line:{width:0}});
s.addText([{text:"Answer fully.  ",options:{bold:true}},{text:"This is where the Companion begins to know you. A sentence more beats a sentence less.",options:{}}],{x:0.9,y:4.58,w:6.9,h:0.9,fontFace:HEAD,color:WHITE,fontSize:16,align:"left",valign:"middle",lineSpacingMultiple:1.1,margin:0});
s.addImage({path:RINGS,x:9.05,y:1.95,w:3.1,h:3.1});
s.addText("The outer ring is Reconnect — where every Comeback begins.",{x:8.7,y:5.15,w:3.85,h:0.7,fontFace:HEAD,italic:true,color:GREY,fontSize:13,align:"center",valign:"top",lineSpacingMultiple:1.05,margin:0});
chrome(s,9,false);

s=p.addSlide();s.background={color:WHITE};
title(s,"How far to go.","Go at the pace that keeps you honest.");
const miles=[["A full first sitting","Onboarding → Threshold → Tour → settled with the Companion.",NAVY,null],["Your first Session","The Doors.",TEAL,null],["A meaningful taste","All the way through the Reconnect Checkpoint — where your first work is measured and your Grinta moves for the first time.",OLIVE,null],["The full experience","The whole Program at a real pace.",ORANGE,"60"]];
miles.forEach((m,i)=>{const y=1.78+i*1.02;s.addShape(oval,{x:0.65,y:y+0.12,w:0.28,h:0.28,fill:{color:m[2]},line:{width:0}});if(i<3)s.addShape(rect,{x:0.785,y:y+0.4,w:0.02,h:0.74,fill:{color:LGREY},line:{width:0}});s.addText(m[0],{x:1.2,y,w:7.9,h:0.36,fontFace:HEAD,bold:true,color:NAVY,fontSize:17.5,align:"left",margin:0});s.addText(m[1],{x:1.2,y:y+0.35,w:8.2,h:0.6,fontFace:HEAD,color:BODY,fontSize:14,align:"left",valign:"top",lineSpacingMultiple:1.05,margin:0});if(m[3])s.addText([{text:"~60",options:{fontSize:40,bold:true,color:ORANGE,breakLine:true}},{text:"DAYS, for most people",options:{fontSize:12,bold:true,color:GREY,charSpacing:1}}],{x:9.8,y:y-0.32,w:3.0,h:1.1,fontFace:HEAD,align:"left",valign:"top",lineSpacingMultiple:0.9,margin:0});});
s.addText("You can move through it quickly. Moving slowly is what makes it real.",{x:1.2,y:6.15,w:11.0,h:0.4,fontFace:HEAD,italic:true,color:TEALD,fontSize:15,align:"left",margin:0});
chrome(s,10,false);

s=p.addSlide();s.background={color:WHITE};
title(s,"How to engage well.","A few habits that make it work.");
const eng=[["Talk like a person","Plain words, real life. The Companion is built to be spoken to.",NAVY],["Answer in full","When a Session asks something, give it the whole answer — details and all.",TEAL],["Stop and return","Interrupted? Stop. Nothing is lost; you pick up where you left off.",OLIVE],["Honesty over finishing","Racing to the end gives you a demo. Going slowly gives you your Comeback.",ORANGE]];
eng.forEach((c,i)=>{const x=0.6+(i%2)*6.15,y=1.95+Math.floor(i/2)*2.05;s.addShape(rr,{x,y,w:5.9,h:1.85,rectRadius:0.12,fill:{color:OFF},line:{color:LGREY,width:1}});s.addShape(oval,{x:x+0.35,y:y+0.35,w:0.5,h:0.5,fill:{color:c[2]},line:{width:0}});s.addText(c[0],{x:x+1.05,y:y+0.32,w:4.6,h:0.55,fontFace:HEAD,bold:true,color:NAVY,fontSize:18,align:"left",valign:"middle",margin:0});s.addText(c[1],{x:x+0.4,y:y+1.0,w:5.15,h:0.7,fontFace:HEAD,color:BODY,fontSize:14.5,align:"left",valign:"top",lineSpacingMultiple:1.1,margin:0});});
chrome(s,11,false);

s=p.addSlide();s.background={color:WHITE};
title(s,"As you go.","For our team and Charter circle.");
s.addShape(rr,{x:0.6,y:2.05,w:12.13,h:2.5,rectRadius:0.14,fill:{color:NAVY},line:{width:0}});
s.addText([{text:"You're among the first through this.",options:{bold:true,fontSize:22,breakLine:true,paraSpaceAfter:10}},{text:"If something snags — a confusing moment, a word that feels off, a place the honesty broke — jot it down and send it our way. Your read is how we make it right for everyone who follows.",options:{fontSize:17}}],{x:1.05,y:2.4,w:11.2,h:1.9,fontFace:HEAD,color:WHITE,align:"left",valign:"top",lineSpacingMultiple:1.14,margin:0});
s.addText("Note what helped or got in the way of being honest — that's the signal we most want.",{x:0.62,y:4.8,w:11.5,h:0.4,fontFace:HEAD,italic:true,color:GREY,fontSize:14.5,align:"left",margin:0});
chrome(s,12,false);

s=p.addSlide();s.background={color:WHITE};
s.addImage({path:RINGS,x:5.42,y:1.15,w:2.5,h:2.5});
s.addText("This is your Comeback.",{x:1,y:4.05,w:11.33,h:0.8,fontFace:HEAD,bold:true,color:NAVY,fontSize:40,align:"center",margin:0});
s.addText("Take your time. We built it to meet you honestly — meet it the same way.",{x:1,y:4.95,w:11.33,h:0.6,fontFace:HEAD,color:GREY,fontSize:20,align:"center",margin:0});
chrome(s,null,false);

p.writeFile({fileName:require("path").join(__dirname,"G4L_Beginning_Your_Comeback_Tutorial.pptx")}).then(f=>console.log("WROTE",f)).catch(e=>{console.error(e);process.exit(1);});
