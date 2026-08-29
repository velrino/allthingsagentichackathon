# ClassGame — 4-minute demo pitch

Target runtime: **3:50–4:00** at a calm pace (~440 spoken words ≈ 110 words/min). Keep the Loom camera bubble visible and use the screen actions in brackets as silent cues.

**Names:** **Emily** is the AI agent (the UI says "Emily's preview", "Emily remembers…"). The human teacher in the story is **Sarah**. Never call the teacher Emily.

Before recording:

- Prepare a Grade 5 math class with existing learning insights and open its overview. Rename the demo class from `TEST` to something like `Grade 5 Math` so it reads well on camera.
- Open the student home and teacher dashboard in separate tabs.
- Start with the student join modal on the left and the teacher dashboard on the right, matching `assets/pitch/01-1.png`.
- Keep your Loom camera bubble visible at the bottom. During the introduction, join as **Bruce** with the class code shown on the dashboard and finish on the layout in `assets/pitch/01-2.png`.
- Open `assets/grade/5th/math` in Finder, ready to select its three PDF worksheets (Classifying angles, Multiplying by 10/100/1,000, Build a 5-digit number).
- Test mission generation before recording. Keep the live generation in one take and use its waiting time to explain what Emily is building.
- Confirm that the generated preview shows Gemini output, **not** the local fallback banner visible in `assets/pitch/02-1.png` and `assets/pitch/02-2.png` (those screenshots are from a fallback run — retake them if there is time).
- Use one intentionally wrong answer during the student demo to reveal Emily's adaptive loop.
- Keep the browser zoom high enough for the mission, tutor response, and teacher report to be readable.
- Section 0:35–1:25 is the tightest (live generation + 3 uploads). Rehearse it with a timer.

## 0:00–0:35 — The idea

*[Screen: start with the layout below — student join modal on the left, teacher dashboard on the right, Loom camera bubble at the bottom. While speaking, enter the visible class code, type "Bruce," and click "Enter class."]*

<p align="center"><img src="assets/pitch/01-1.png" width="600" alt="Student join modal on the left, teacher dashboard with the class card and 6-digit code on the right"></p>

Hi, my name is Denis. I believe teachers and AI can work together to help students learn better — and have fun doing it.

I've worked in tech for 12 years, and I built ClassGame alone for this hackathon — for desktop and mobile.

On the left, Bruce joins with the six-digit code from the teacher's dashboard on the right. His 3D classroom and the dashboard are now connected.

But how does it actually work?

*[Screen: finish this section with Bruce inside the room, as below.]*

<p align="center"><img src="assets/pitch/01-2.png" width="600" alt="Bruce standing in the 3D classroom next to the teacher dashboard"></p>

## 0:35–1:25 — Sarah prepares the next lesson

*[Screen: click "Open" on the class card, maximize the teacher window, then point to the class insights.]*

Meet Sarah, a fifth-grade math teacher. Past activities show her class needs more help with place value and types of angles.

*[Screen: click "New mission." Attach all three PDFs from `assets/grade/5th/math`, then generate the preview. Show a question and its choices as below.]*

<p align="center"><img src="assets/pitch/02-1.png" width="600" alt="Edit mission panel with three PDFs attached and the Preview tab showing question 1 with four choices"></p>

Sarah adds three real PDFs from her class. Emily — the Gemini agent inside ClassGame — reads the files and writes three questions.

*[Screen: open "Flow," zoom in until the labels are readable, and briefly follow the map from top to bottom.]*

<p align="center"><img src="assets/pitch/02-2.png" width="600" alt="Flow tab showing the lesson map: setup, quick diagnostic, guided practice, reflection, understanding check, adaptive feedback, complete"></p>

In Preview, Sarah checks every question and answer. In Flow, she sees the lesson map: a quick check, guided practice, reflection, extra help when needed, and completion. She can edit everything before students see it.

*[Screen: click "Approve and assign to class," then switch to the student tab.]*

When Sarah approves, the mission appears for her class in real time.

## 1:25–2:35 — Bruce plays with Emily

*[Screen: return to the split view and keep the student window unchanged. Pause long enough to show the glowing circle appear beside Bruce's desk, as below. Then maximize the student window, walk into the circle, press Start, and select the mission.]*

<p align="center"><img src="assets/pitch/03-1.png" width="600" alt="Glowing circle beside Bruce's desk in the 3D classroom while the dashboard shows the mission as Published and Live"></p>

Bruce does not refresh. When Sarah publishes, a glowing circle appears next to his desk. He walks to it, presses Start, and chooses the new mission.

This is more than a quiz. Emily remembers every step.

*[Screen: choose an intentionally wrong answer. Show the "why" prompt, then select or type a reason.]*

When Bruce makes a mistake, Emily does not show the answer. First, she asks why. Bruce can pick a reason or write his own.

Before she replies, Emily loads parts of the PDF, Bruce's answers, past messages, and long-term memory. She explains with simple steps or with pictures, based on what helps him.

*[Screen: show the explanation and tap one feedback option.]*

Bruce says if the help was useful, confusing, too easy, or too hard. If he comes back later, the game opens at the same step.

## 2:35–3:25 — Bruce's game becomes classroom evidence

*[Screen: switch to the class overview, then open a student's details and show the tabs Summary, Learning flow, Conversation, and Memory.]*

Back in the dashboard, Bruce's status changes live from playing to completed. Sarah can also see who has not started, or who left early.

Emily uses Bruce's answers, reasons, and feedback to write a learning report. Sarah sees what he does well, what needs more work, his path, and which parts of the PDF were used.

This memory stays for future missions. When several students have the same problem, ClassGame helps Sarah see what the class needs and plan the next lesson. This closes the loop.

## 3:25–3:48 — Built as a real agent

*[Screen: briefly show the architecture section in the README or keep the student report visible.]*

ClassGame uses Gemini on Vertex AI, with a Go API on Cloud Run. Firestore keeps live data and long-term memory. Cloud Tasks runs background jobs, and Redis limits AI requests. Private teacher notes never reach students. If AI is not available, backup logic keeps the game working.

## 3:48–4:00 — Close

*[Screen: return to the 3D classroom; camera remains visible.]*

ClassGame is optional homework that takes notes for the teacher. Emily learns with every student and brings that learning back to class.

Thank you.

---

## Delivery notes

- Pause at every period. Short sentences are on purpose — do not join them.
- Words avoided on purpose (hard for PT-BR speakers): *worksheet* → **PDF**, *strengths* → **what he does well**, *through* → **on / with**, *artificial intelligence* → **AI**, *one thousand* (cut from the topic list).
- Stress the key words: **teachers and AI**, **three real PDFs**, **asks why**, **remembers**, **closes the loop**, **takes notes for the teacher**.
- Word budget per section: 0:00 ≈ 70 · 0:35 ≈ 90 · 1:25 ≈ 110 · 2:35 ≈ 85 · 3:25 ≈ 50 · Close ≈ 25.
