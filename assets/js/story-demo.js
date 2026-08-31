import { createScheduleSvg } from './export.js';

const STORY_DEMO_SCHEDULE = {
  session: 'AnimoSort example week',
  meetings: [
    { courseCode: 'DATA103', title: 'INTRODUCTION TO MACHINE LEARNING', section: 'S04', credits: 3, day: 'TUE', startMinutes: 555, endMinutes: 645, startLabel: '09:15 AM', endLabel: '10:45 AM', location: 'Online', expandedLocation: 'Online' },
    { courseCode: 'DATA103', title: 'INTRODUCTION TO MACHINE LEARNING', section: 'S04', credits: 3, day: 'FRI', startMinutes: 555, endMinutes: 645, startLabel: '09:15 AM', endLabel: '10:45 AM', location: 'Online', expandedLocation: 'Online' },
    { courseCode: 'ECOF223', title: 'ADVANCED FINANCIAL ECONOMETRICS', section: 'V45', credits: 3, day: 'MON', startMinutes: 870, endMinutes: 960, startLabel: '02:30 PM', endLabel: '04:00 PM', location: 'Online', expandedLocation: 'Online' },
    { courseCode: 'ECOF223', title: 'ADVANCED FINANCIAL ECONOMETRICS', section: 'V45', credits: 3, day: 'THU', startMinutes: 870, endMinutes: 960, startLabel: '02:30 PM', endLabel: '04:00 PM', location: 'Online', expandedLocation: 'Online' },
    { courseCode: 'ECOF366', title: 'ECONOMICS OF INFORMATION', section: 'V45', credits: 3, day: 'MON', startMinutes: 660, endMinutes: 750, startLabel: '11:00 AM', endLabel: '12:30 PM', location: 'Online', expandedLocation: 'Online' },
    { courseCode: 'ECOF366', title: 'ECONOMICS OF INFORMATION', section: 'V45', credits: 3, day: 'THU', startMinutes: 660, endMinutes: 750, startLabel: '11:00 AM', endLabel: '12:30 PM', location: 'Online', expandedLocation: 'Online' },
    { courseCode: 'FINIVBA', title: 'INVESTMENT BANKING', section: 'C01', credits: 3, day: 'TUE', startMinutes: 1080, endMinutes: 1170, startLabel: '06:00 PM', endLabel: '07:30 PM', location: 'Online', expandedLocation: 'Online' },
    { courseCode: 'FINIVBA', title: 'INVESTMENT BANKING', section: 'C01', credits: 3, day: 'FRI', startMinutes: 1080, endMinutes: 1170, startLabel: '06:00 PM', endLabel: '07:30 PM', location: 'Online', expandedLocation: 'Online' },
    { courseCode: 'FINSPTO', title: 'SPECIAL TOPICS IN FINANCE', section: 'C05', credits: 3, day: 'TUE', startMinutes: 975, endMinutes: 1065, startLabel: '04:15 PM', endLabel: '05:45 PM', location: 'Online', expandedLocation: 'Online' },
    { courseCode: 'FINSPTO', title: 'SPECIAL TOPICS IN FINANCE', section: 'C05', credits: 3, day: 'FRI', startMinutes: 975, endMinutes: 1065, startLabel: '04:15 PM', endLabel: '05:45 PM', location: 'Online', expandedLocation: 'Online' },
    { courseCode: 'GESTSOC', title: 'SCIENCE, TECHNOLOGY, AND THE SOCIETY', section: 'Y12', credits: 3, day: 'TUE', startMinutes: 870, endMinutes: 960, startLabel: '02:30 PM', endLabel: '04:00 PM', location: 'Online', expandedLocation: 'Online' },
    { courseCode: 'GESTSOC', title: 'SCIENCE, TECHNOLOGY, AND THE SOCIETY', section: 'Y12', credits: 3, day: 'FRI', startMinutes: 870, endMinutes: 960, startLabel: '02:30 PM', endLabel: '04:00 PM', location: 'Online', expandedLocation: 'Online' },
    { courseCode: 'LCASEAN', title: 'THE FILIPINO AND ASEAN', section: 'Z14', credits: 3, day: 'MON', startMinutes: 450, endMinutes: 540, startLabel: '07:30 AM', endLabel: '09:00 AM', location: 'Online', expandedLocation: 'Online' },
    { courseCode: 'LCASEAN', title: 'THE FILIPINO AND ASEAN', section: 'Z14', credits: 3, day: 'THU', startMinutes: 450, endMinutes: 540, startLabel: '07:30 AM', endLabel: '09:00 AM', location: 'Online', expandedLocation: 'Online' },
  ],
};

const storyOutput = document.querySelector('#story-demo-output');
const sourceReceipt = document.querySelector('#story-source-receipt');
const sourceDialog = document.querySelector('#story-source-dialog');
const sourceClose = document.querySelector('#story-source-close');

if (storyOutput) {
  const svg = createScheduleSvg(STORY_DEMO_SCHEDULE, {
    showCourseTitles: true,
    theme: 'light',
  });
  storyOutput.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  storyOutput.dataset.ready = 'true';
}

if (sourceReceipt && sourceDialog && sourceClose) {
  sourceReceipt.addEventListener('click', () => sourceDialog.showModal());
  sourceClose.addEventListener('click', () => sourceDialog.close());
  sourceDialog.addEventListener('click', (event) => {
    if (event.target === sourceDialog) sourceDialog.close();
  });
}
