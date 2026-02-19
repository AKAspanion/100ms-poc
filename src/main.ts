import { createApp } from 'vue';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import App from './App.vue';
import router from './router';
import './style.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import 'primevue/resources/themes/arya-blue/theme.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(PrimeVue, { ripple: true });
app.mount('#app')

