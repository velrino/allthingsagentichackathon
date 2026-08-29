# ClassGame — 4-minute demo pitch

Target runtime: **3:50–4:00** at a calm pace. Keep the Loom camera bubble visible and use the screen actions in brackets as silent cues.

Before recording:

- Prepare a Grade 5 class with existing learning insights and open its overview.
- Open the student home and teacher dashboard in separate tabs.
- Start with the student join modal on the left and the teacher dashboard on the right, matching `assets/pitch/01-1.png`.
- Keep your Loom camera bubble visible at the bottom. During the introduction, join as **Bruce** with the class code shown on the dashboard and finish on the layout in `assets/pitch/01-2.png`.
- Open `assets/grade/5th/math` in Finder, ready to select its three PDF worksheets.
- Test mission generation before recording. Keep the live generation in one take and use its waiting time to explain what Gemini is building.
- Confirm that the generated preview shows Gemini, not the local fallback message visible in `assets/pitch/02-1.png` and `assets/pitch/02-2.png`.
- Use one intentionally wrong answer during the student demo to reveal Emily's adaptive loop.
- Keep the browser zoom high enough for the mission, tutor response, and teacher evidence to be readable.

## 0:00–0:35 — The idea

*[Screen: start with `assets/pitch/01-1.png`: student join modal on the left, teacher dashboard on the right, and your Loom camera bubble at the bottom. While speaking, enter the visible class code, type “Bruce,” and click “Enter class.” Finish this section with Bruce inside the room as in `assets/pitch/01-2.png`.]*

Hi, my name is Denis. I believe teachers and artificial intelligence can work together to help students learn better, in a fun way.

After 12 years in technology, I built ClassGame for desktop and mobile.

On the left, Bruce joins with the six-digit code shown on the right. His 3D classroom and Emily's dashboard are now connected.

But how does it actually work?

## 0:35–1:25 — Emily prepares the next lesson

*[Screen: click “Open” on the class card, maximize the teacher window, then point to the class insights and “Build tomorrow's mission.”]*

Meet Emily, a fifth-grade math teacher. Past activities show that her class needs more help with place value, multiplying by ten, one hundred, and one thousand, and types of angles. ClassGame shows the score, the answers, and the feedback.

*[Screen: click “Build tomorrow's mission.” Attach all three PDFs from `assets/grade/5th/math`, then generate the preview. Show a question and its choices as in `assets/pitch/02-1.png`. Open “Flow” as in `assets/pitch/02-2.png`, zoom in until the labels are readable, and briefly follow the map from top to bottom.]*

Emily uses this result to build tomorrow's mission. She adds three real worksheets from her class.

Gemini reads the files and creates three questions. In Preview, Emily checks each question and answer. Flow shows the lesson map: a quick check, guided practice, reflection, extra help when needed, and completion. She can edit everything before students see it.

*[Screen: click “Approve and assign to class,” then switch to the student tab.]*

When Emily approves the mission, it appears for her class right away through Firestore realtime updates.

## 1:25–2:35 — Bruce plays with an adaptive tutor

*[Screen: return to the split view and keep the student window unchanged. Pause long enough to show the glowing circle appear beside Bruce's desk, matching `assets/pitch/03-1.png`. Then maximize the student window, walk into the circle, press Start, and select the mission.]*

Bruce does not refresh. When Emily publishes, a glowing circle appears beside his desk. He walks to it, presses Start, and chooses the new mission.

This is more than a quiz. The Gemini tutor remembers every step.

*[Screen: choose an intentionally wrong answer. Show the “why” prompt, then select or type a reason.]*

When Bruce makes a mistake, the tutor does not show the answer. First, it asks why. Bruce can choose a reason or write his own.

Before replying, the agent loads parts of the worksheet, Bruce's answers, past messages, and long-term memory. It uses simple steps or pictures based on what helps him.

*[Screen: show the explanation and tap one feedback option.]*

Bruce says if the help was useful, confusing, too easy, or too hard. If he returns later, the game opens at the same step.

## 2:35–3:25 — Bruce's experience becomes classroom evidence

*[Screen: switch to the class overview, then open a student's details and show Summary, Learning flow, Evidence, and Memory.]*

Back in the dashboard, Bruce's status changes live from playing to completed. Emily can also see who has not started or left early.

Gemini uses Bruce's answers, reasons, and feedback to make a learning report. Emily sees his strengths, topics needing more work, his path, and the worksheet information used.

This memory stays for future missions. When several students have the same problem, ClassGame helps Emily understand what the class needs and plan the next lesson. This closes the loop.

## 3:25–3:48 — Built as a real agent

*[Screen: briefly show the architecture section in the README or keep the evidence view visible.]*

ClassGame uses Gemini through Vertex AI and a Go API on Cloud Run. Firestore keeps live data and long-term memory. Cloud Tasks runs background work, and Redis limits AI requests. Private teacher notes never appear to students. If AI is not available, backup logic keeps the game working.

## 3:48–4:00 — Close

*[Screen: return to the 3D classroom; camera remains visible.]*

ClassGame is optional homework that takes notes for the teacher. It learns with every student and brings that learning back to class.

Thank you.
