import { startFinder } from '../finder/page.js';

const app = document.getElementById('app');
const live = document.getElementById('live');
if (app) startFinder(app, live);
