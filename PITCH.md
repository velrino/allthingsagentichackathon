# ClassGame — 4-minute demo pitch

Target runtime: **3:50–4:00** at a calm pace. Keep the Loom camera bubble visible and use the screen actions in brackets as silent cues.

Before recording:

- Open the student home, the teacher mission builder, and the teacher class overview in separate tabs.
- Have one mission preview ready so the video never waits for generation.
- Use one intentionally wrong answer during the student demo to reveal Emily's adaptive loop.
- Keep the browser zoom high enough for the mission, tutor response, and teacher evidence to be readable.

## 0:00–0:35 — The idea

*[Screen: student home page; camera visible.]*

Hi, my name is Denis, and I believe that, with the help of teachers, we can improve student performance in the classroom in a fun and intelligent way — literally, with artificial intelligence.

That's why I used everything I've learned over the past 12 years in technology to build ClassGame for desktop and mobile.

Teachers create missions for their students, while students explore an interactive 3D game powered by Google Gemini.

But how does it actually work?

## 0:35–1:20 — Teacher creates a mission

*[Screen: teacher dashboard, then open the prepared mission in the mission builder. Point to the learning goal, teacher prompt, attachments, and preview.]*

The teacher starts with what they already know: what the class studied, the learning goal, and what students may be struggling with. They can also attach real classroom material, such as a worksheet.

Emily turns that context into a short, three-question mission. Gemini creates the questions, multiple-choice answers, misconception traps, explanations, and a structured learning flow. The teacher stays in control: they can edit the content, regenerate the preview, and approve it only when it is ready.

*[Screen: click “Approve and assign to class,” then switch to the student tab.]*

Once approved, the mission appears instantly for the class through Firestore realtime updates.

## 1:20–2:35 — Student plays with an adaptive tutor

*[Screen: enter the six-digit class code, choose an avatar, enter the classroom, walk to the glowing desk, press Start, and select the mission.]*

The student needs only the class code and a name. They choose a character, enter the classroom, and walk to the glowing desk. Every unfinished mission is waiting here, with no extra mission code to remember.

This is not just a quiz with an AI label. Emily leads a stateful, multi-turn conversation on the chalkboard.

*[Screen: choose an intentionally wrong answer. Show the “why” prompt, then select or type a reason.]*

When a student makes a mistake, Emily does not immediately reveal the answer. She asks why they chose it. The student can select a reason or explain it in their own words.

Before responding, the agent retrieves context from the teacher's material, the current attempt, previous tutor turns, and the student's persistent learning memory. It can then change the explanation style, adjust the next step, and explain why it adapted.

*[Screen: show the explanation and tap one feedback option.]*

The student can say whether an explanation was helpful, confusing, too easy, or too hard. Close the tab and return later, and the exact question, phase, and board state are restored instead of starting over.

## 2:35–3:25 — The teacher gets evidence, not guesses

*[Screen: switch to the class overview, then open a student's details and show Summary, Learning flow, Evidence, and Memory.]*

Meanwhile, the teacher sees the class update live: who has not started, who is playing now, who left early, and who completed the mission.

After an attempt, Gemini turns observable answers, explicit reasoning, and feedback into a learning trace. The teacher can inspect the student's strengths, areas to revisit, the path they took, and the evidence behind every insight — including which retrieved knowledge chunks grounded each tutor turn.

That memory survives across sessions and missions. ClassGame also combines individual patterns into class-level insights, so the teacher can build tomorrow's mission from today's evidence.

## 3:25–3:48 — Built as a real agent

*[Screen: briefly show the architecture section in the README or keep the evidence view visible.]*

Under the hood, Gemini runs through Vertex AI behind a Go API on Cloud Run. Firestore stores realtime classroom state and durable memory. Cloud Tasks handles reliable background work, and Redis enforces distributed AI rate limits. Student-facing responses are separated from teacher-only observations, and deterministic fallbacks keep the lesson moving if the model is unavailable.

## 3:48–4:00 — Close

*[Screen: return to the 3D classroom; camera remains visible.]*

ClassGame is the optional homework that takes notes for the teacher: a collaborative partner that learns with every student and gives that learning back to the classroom.

Thank you.
