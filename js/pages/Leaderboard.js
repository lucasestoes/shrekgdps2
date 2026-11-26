import { fetchLeaderboard } from "../content.js";
import { localize } from "../util.js";
import Spinner from "../components/Spinner.js";

export default {
  components: { Spinner },
  data: () => ({
    leaderboard: [],
    nationalities: {},
    assetsUrl: new URL("../../assets/", import.meta.url).href,
    loading: true,
    selected: 0,
    err: [],
    searchQuery: "", // for filtering the leaderboard
  }),
  computed: {
    filteredLeaderboard() {
      if (!this.searchQuery) return this.leaderboard;
      return this.leaderboard.filter(
        (entry) =>
          entry.user &&
          entry.user.toLowerCase().includes(this.searchQuery.toLowerCase())
      );
    },
    selectedEntry() {
      return this.filteredLeaderboard[this.selected] || null;
    },
    selectedRank() {
      if (!this.selectedEntry) {
        return "-";
      }
      let idx = this.leaderboard.findIndex(
        (e) => e.user === this.selectedEntry.user
      );
      return idx >= 0 ? idx + 1 : this.selected + 1;
    },
    selectedHardest() {
      if (!this.selectedEntry) return null;

      const beaten = [
        ...(this.selectedEntry.verified || []),
        ...(this.selectedEntry.completed || []),
      ];

      if (beaten.length === 0) return null;

      return beaten.sort((a, b) => a.rank - b.rank)[0];
    },
  },
  watch: {
    searchQuery() {
      this.selected = 0;
    },
  },
  async mounted() {
    const [leaderboard, err] = await fetchLeaderboard();
    this.leaderboard = leaderboard;
    this.err = err;

    // Resolve /data/_nationalities.json relative to js/pages/Leaderboard.js
    const dataUrl = new URL("../../data/_nationalities.json", import.meta.url).href;

    try {
      const res = await fetch(dataUrl);
      if (res.ok) {
        const raw = await res.json();
        this.nationalities = Object.fromEntries(
          Object.entries(raw).map(([k, v]) => [
            k.trim().toLowerCase(),
            v.trim(),
          ])
        );
      } else {
        console.error(`Failed to load _nationalities.json (${res.status}) at:`, dataUrl);
      }
    } catch (e) {
      console.error("Error parsing _nationalities.json:", e);
    }

    this.loading = false;
  },
  methods: {
    localize,
    getFlagUrl(username) {
      if (!username) return null;
      const code = this.nationalities[username.trim().toLowerCase()];
      return code ? `${this.assetsUrl}${code}.svg` : null;
    },
    onFlagError(event, username) {
      console.error(`Flag image failed to load for ${username}:`, event.target.src);
      event.target.style.display = "none";
    },
  },
  template: `
    <main v-if="loading">
      <Spinner></Spinner>
    </main>
    <main v-else class="page-leaderboard-container">
      <div class="page-leaderboard">
        <div class="error-container">
          <p class="error" v-if="err.length > 0">
            Leaderboard may be incorrect, as the following levels could not be loaded: {{ err.join(', ') }}
          </p>
        </div>
        <div class="board-container">
          <!-- Leaderboard search bar -->
          <div class="search-bar">
            <input type="text" v-model="searchQuery" placeholder="Search users..." />
          </div>
          <table class="board">
            <tr v-for="(entry, i) in filteredLeaderboard" :key="i">
              <td class="rank">
                <p class="type-label-lg">
                  #{{ leaderboard.findIndex(e => e.user === entry.user) + 1 }}
                </p>
              </td>
              <td class="total">
                <p class="type-label-lg">{{ localize(entry.total) }}</p>
              </td>
              <td class="user" :class="{ 'active': selected === i }">
                <button @click="selected = i">
                  <span class="type-label-lg">{{ entry.user }}</span>
                </button>
              </td>
            </tr>
          </table>
          <p v-if="filteredLeaderboard.length === 0" class="no-results">
            No results found for "{{ searchQuery }}"
          </p>
        </div>
        <!-- Details panel: only display if there is a valid selection -->
        <div class="player-container" v-if="selectedEntry">
          <div class="player">
            <h1>
              #{{ selectedRank }} {{ selectedEntry.user }}
              <img
                v-if="getFlagUrl(selectedEntry.user)"
                :src="getFlagUrl(selectedEntry.user)"
                :alt="selectedEntry.user"
                @error="onFlagError($event, selectedEntry.user)"
                style="display: inline-block; width: 40px; min-width: 40px; height: 30px; vertical-align: middle; margin-left: 10px; border-radius: 3px; object-fit: cover;"
              />
            </h1>
            <h3>{{ localize(selectedEntry.total) }}</h3>
            <h3 v-if="selectedHardest">
              Hardest Demon: <a target="_blank" :href="selectedHardest.link">{{ selectedHardest.level }}</a>
            </h3>
            <h3 v-else>
              Hardest Demon: None
            </h3>
            <h2 v-if="selectedEntry.verified && selectedEntry.verified.length > 0">
              Verified ({{ selectedEntry.verified.length }})
            </h2>
            <table class="table" v-if="selectedEntry.verified && selectedEntry.verified.length > 0">
              <tr v-for="score in selectedEntry.verified">
                <td class="rank">
                  <p>#{{ score.rank }}</p>
                </td>
                <td class="level">
                  <a class="type-label-lg" target="_blank" :href="score.link">{{ score.level }}</a>
                </td>
                <td class="score">
                  <p>+{{ localize(score.score) }}</p>
                </td>
              </tr>
            </table>
            <h2 v-if="selectedEntry.completed && selectedEntry.completed.length > 0">
              Completed ({{ selectedEntry.completed.length }})
            </h2>
            <table class="table" v-if="selectedEntry.completed && selectedEntry.completed.length > 0">
              <tr v-for="score in selectedEntry.completed">
                <td class="rank">
                  <p>#{{ score.rank }}</p>
                </td>
                <td class="level">
                  <a class="type-label-lg" target="_blank" :href="score.link">{{ score.level }}</a>
                </td>
                <td class="score">
                  <p>+{{ localize(score.score) }}</p>
                </td>
              </tr>
            </table>
            <h2 v-if="selectedEntry.progressed && selectedEntry.progressed.length > 0">
              Progressed ({{ selectedEntry.progressed.length }})
            </h2>
            <table class="table" v-if="selectedEntry.progressed && selectedEntry.progressed.length > 0">
              <tr v-for="score in selectedEntry.progressed">
                <td class="rank">
                  <p>#{{ score.rank }}</p>
                </td>
                <td class="level">
                  <a class="type-label-lg" target="_blank" :href="score.link">
                    {{ score.percent }}% {{ score.level }}
                  </a>
                </td>
                <td class="score">
                  <p>+{{ localize(score.score) }}</p>
                </td>
              </tr>
            </table>
          </div>
        </div>
      </div>
    </main>
  `,
};
