# IELTS Writing Practice Simulator

A small, offline-friendly web app for practising **IELTS Academic Writing** under exam conditions: timed, with no spellcheck and a live word count, and every answer saved so you can review and compare your attempts later.

**Live site:** https://gamalthecreator.github.io/ielts-writing-practice/

## Features
- **Three modes:** Task 1 only (20 min), Task 2 only (40 min), or the full test (60 min shared, with Part 1 / Part 2 tabs as in the computer-delivered test).
- **Question bank:** 18 Task 1 questions with charts (line, bar, pie, table, process, maps, floor plan, mixed) and 12 Task 2 questions covering the five common essay types. Pick a question from a dropdown, or choose "Random" to get one you haven't done yet.
- **Exam-like editor:** spellcheck and autocorrect are off, there is a live word count, the timer can be hidden, warnings appear at 10, 5 and 1 minutes left, and an optional lock auto-submits at 0:00.
- **Auto-save and resume:** an unfinished test survives a closed tab or a browser crash.
- **Review after submitting:** word count and time used, a self-check list, and for Task 1 the overview hint, the exact data, tips for that chart type and a language bank. For Task 2 it shows what that question type requires.
- **History:** filter by task or question, reopen past answers, and **compare 2–3 attempts side by side**. Each attempt can be given a band and notes.
- **Error log:** your personal list of mistakes, shown on the start screen before every test.
- **Copy for feedback:** copies the question, your answer, the word count and your time in one click.
- **Back up and restore:** export and import all your answers as a JSON file.

## Using it
Open the live site, or run it locally: download the repository and open `IELTS_Writing_Simulator/index.html` in Chrome or Edge. There is no server, build step or install.

`IELTS_Writing_Simulator/` and `IELTS_Task1_Charts/` must stay side by side.

## Your data
Answers are stored only in your browser (`localStorage`). Nothing is sent anywhere. Because of that:
- Each browser, and the local file versus the live site, keeps **separate** data.
- Clearing your browsing data deletes it. Use **My answers → Back up** regularly.
- To move your answers between browsers or devices, use **Back up** on one and **Restore** on the other.

## Project structure
```
index.html                    redirects to the simulator
IELTS_Writing_Simulator/
  index.html, style.css, app.js
  task1.js                    generated from IELTS_Task1_Practice.md, do not edit by hand
  task2.js                    Task 2 questions (edit directly)
  build_questions.py          regenerates task1.js
IELTS_Task1_Charts/           chart images for the Task 1 questions
IELTS_Task1_Practice.md       Task 1 questions, data, hints and language bank
```

## Editing the questions
- **Task 1:** edit `IELTS_Task1_Practice.md`, then regenerate the questions file (this needs Python with the `markdown` package):
  ```
  cd IELTS_Writing_Simulator
  python build_questions.py
  ```
- **Task 2:** edit `IELTS_Writing_Simulator/task2.js` directly.

## Disclaimer
This is an unofficial personal study tool. It is not affiliated with or endorsed by IELTS, the British Council, IDP or Cambridge University Press & Assessment. All questions and charts are original practice material, not official exam questions.
