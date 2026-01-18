/**
 * Signalboard Cloudflare Worker
 * Serves UI and API endpoints for feedback management and digest generation
 */

interface FeedbackRow {
	id: number;
	source: string;
	title: string | null;
	content: string;
	created_at: string;
	theme: string | null;
	sentiment: string | null;
	urgency: string | null;
	tags: string | null;
}

interface ClassificationResult {
	theme: string;
	sentiment: string;
	urgency: string;
	tags: string[];
}

interface DigestResult {
	executive_summary: string;
	top_themes: { theme: string; count: number }[];
	sentiment_breakdown: { sentiment: string; count: number }[];
	urgent_ids: number[];
}

interface DigestRow {
	id: number;
	cadence: string;
	period_start: string;
	period_end: string;
	summary: string;
	themes_json: string;
	sentiment_json: string;
	urgent_ids_json: string;
	created_at: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;
		const method = request.method;

		try {
			// UI Routes
			if (method === 'GET' && path === '/') {
				return handleDashboard(env);
			}
			if (method === 'GET' && path === '/feedback') {
				return handleFeedbackPage(env, url);
			}

			// API Routes
			if (method === 'POST' && path === '/api/seed') {
				return handleSeed(env);
			}
			if (method === 'POST' && path === '/api/feedback') {
				return handleCreateFeedback(request, env);
			}
			if (method === 'GET' && path === '/api/feedback') {
				return handleGetFeedback(env, url);
			}
			if (method === 'POST' && path === '/api/digest') {
				return handleCreateDigest(request, env);
			}
			if (method === 'GET' && path === '/api/digest') {
				return handleGetDigest(env, url);
			}

			return jsonResponse({ error: 'Not found' }, 404);
		} catch (error) {
			console.error('Error:', error);
			return jsonResponse(
				{ error: error instanceof Error ? error.message : 'Internal server error' },
				500
			);
		}
	},
} satisfies ExportedHandler<Env>;

// UI Handlers
async function handleDashboard(env: Env): Promise<Response> {
	const html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>SignalBoard</title>
	<style>
		:root{
			--cf-orange:#F38020;
			--cf-orange-2:#FA9C2D;
			--bg:#F9FAFB;
			--card:#FFFFFF;
			--text:#111827;
			--muted:#6B7280;
			--border:#E5E7EB;
			--shadow-sm: 0 2px 10px rgba(17,24,39,0.06);
			--radius: 16px;
		}
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
			background: radial-gradient(1200px 600px at 20% -10%, rgba(243,128,32,0.15), transparent 55%),
									radial-gradient(900px 500px at 90% 0%, rgba(250,156,45,0.12), transparent 60%),
									var(--bg);
			padding: 24px;
			color: var(--text);
		}
		.container { max-width: 1200px; margin: 0 auto; }
		.topbar{
			display:flex;
			align-items:flex-start;
			justify-content:space-between;
			gap:16px;
			padding:16px 18px;
			border:1px solid var(--border);
			background: rgba(255,255,255,0.85);
			backdrop-filter: blur(8px);
			border-radius: var(--radius);
			box-shadow: var(--shadow-sm);
			margin-bottom: 18px;
		}
		.brand h1{
			font-size: 18px;
			line-height: 1.2;
			margin:0;
			font-weight: 800;
		}
		.brand .subtitle{
			font-size: 13px;
			color: var(--muted);
			margin-top: 4px;
		}

		.controls {
			display:flex;
			gap:10px;
			align-items:center;
			flex-wrap:wrap;
			justify-content:flex-end;
		}
		select, button, a.button-link{
			height: 38px;
			padding: 0 14px;
			border-radius: 12px;
			border: 1px solid var(--border);
			font-size: 14px;
		}
		select{
			background:white;
			color:var(--text);
		}
		button{
			cursor:pointer;
			border: 1px solid transparent;
			color:white;
			background: linear-gradient(135deg, var(--cf-orange), var(--cf-orange-2));
			box-shadow: 0 10px 18px rgba(243,128,32,0.20);
			font-weight: 700;
		}
		button:hover{ filter: brightness(0.98); transform: translateY(-1px); }
		button:disabled{ opacity: 0.6; cursor:not-allowed; transform:none; box-shadow:none; }
		.ghost{
			background:white;
			color:var(--text);
			border:1px solid var(--border);
			box-shadow:none;
			font-weight: 700;
		}
		.ghost:hover{ background:#fff7ed; }

		.button-link{
			display:inline-flex;
			align-items:center;
			text-decoration:none;
			color: var(--text);
			background: white;
			font-weight: 700;
		}
		#error { margin-top: 14px; }
		.error{
			padding: 10px 12px;
			border-radius: 14px;
			border: 1px solid rgba(239,68,68,0.35);
			background: rgba(239,68,68,0.08);
			color: #991B1B;
		}
		.grid{
			display:grid;
			grid-template-columns: 1fr 1fr;
			gap: 16px;
		}
		@media (max-width: 900px){
			.grid{ grid-template-columns: 1fr; }
			.controls{ justify-content:flex-start; }
		}
		.card{
			background: var(--card);
			border: 1px solid var(--border);
			border-radius: var(--radius);
			box-shadow: var(--shadow-sm);
			padding: 16px;
		}
		.card h2{
			font-size: 12px;
			letter-spacing: 0.06em;
			text-transform: uppercase;
			color: var(--muted);
			margin-bottom: 12px;
		}

		.bar-chart{ display:flex; flex-direction:column; gap:10px; }
		.bar-item{ display:flex; align-items:center; gap:12px; }
		.bar-label{
			width: 170px;
			font-size: 13px;
			color: var(--text);
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		.bar{
			flex:1;
			height: 10px;
			background:#F3F4F6;
			border-radius:999px;
			overflow:hidden;
		}
		.bar-fill{
			height:100%;
			background: linear-gradient(90deg, var(--cf-orange), var(--cf-orange-2));
		}
		.bar-value{
			width: 44px;
			text-align:right;
			font-size:12px;
			color:var(--muted);
			font-variant-numeric: tabular-nums;
		}
		.urgent-list{ list-style:none; display:flex; flex-direction:column; gap:10px; }
		.urgent-item{
			border:1px solid rgba(243,128,32,0.35);
			background: rgba(243,128,32,0.08);
			padding:12px;
			border-radius: 14px;
		}
		.urgent-item strong{ display:block; margin-bottom:4px; }
		.urgent-item small{ color: var(--muted); }
		.loading{ color: var(--muted); padding: 10px 0; }
	</style>
</head>
<body>
	<div class="container">
		<div class="topbar">
			<div class="brand">
				<h1>SignalBoard</h1>
				<div class="subtitle">Turn scattered feedback into themes, sentiment, and urgency.</div>
			</div>
			<div class="controls">
				<select id="cadence" aria-label="Cadence">
					<option value="daily">Daily</option>
					<option value="weekly">Weekly</option>
					<option value="monthly">Monthly</option>
				</select>
				<button class="ghost" onclick="seedData()">Seed Mock Data</button>
				<button onclick="generateDigest()">Generate Digest</button>
				<a href="/feedback" class="button-link">View Feedback →</a>
			</div>
		</div>

		<div id="error"></div>

		<div class="grid">
			<div class="card">
				<h2>Top Themes</h2>
				<div id="themes" class="bar-chart"><div class="loading">Loading themes...</div></div>
			</div>

			<div class="card">
				<h2>Sentiment Breakdown</h2>
				<div id="sentiment" class="bar-chart"><div class="loading">Loading sentiment...</div></div>
			</div>

			<div class="card" style="grid-column: 1 / -1;">
				<h2>Urgent Items</h2>
				<ul id="urgent" class="urgent-list"><li class="loading">Loading urgent items...</li></ul>
			</div>
		</div>
	</div>

	<script>
		async function seedData() {
			const btn = event.target;
			btn.disabled = true;
			btn.textContent = 'Seeding...';
			try {
				const res = await fetch('/api/seed', { method: 'POST' });
				const data = await res.json();
				if (res.ok) {
					alert('Mock data seeded successfully!');
					loadDashboard();
				} else {
					showError(data.error || 'Failed to seed data');
				}
			} catch (e) {
				showError('Failed to seed data: ' + e.message);
			} finally {
				btn.disabled = false;
				btn.textContent = 'Seed Mock Data';
			}
		}
		async function generateDigest() {
			const cadence = document.getElementById('cadence').value;
			const btn = event.target;
			btn.disabled = true;
			btn.textContent = 'Generating...';
			try {
				const res = await fetch('/api/digest', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ cadence })
				});
				const data = await res.json();
				if (res.ok) {
					alert('Digest generated successfully!');
					loadDashboard();
				} else {
					showError(data.error || 'Failed to generate digest');
				}
			} catch (e) {
				showError('Failed to generate digest: ' + e.message);
			} finally {
				btn.disabled = false;
				btn.textContent = 'Generate Digest';
			}
		}
		async function loadDashboard() {
			try {
				const res = await fetch('/api/digest');
				const digest = await res.ok ? await res.json() : null;

				if (digest && !digest.error) {
					renderThemes(digest.top_themes || []);
					renderSentiment(digest.sentiment_breakdown || []);
					await renderUrgent(digest.urgent_ids || []);
				} else {
					document.getElementById('themes').innerHTML = '<div class="loading">No digest available. Generate one first.</div>';
					document.getElementById('sentiment').innerHTML = '<div class="loading">No digest available. Generate one first.</div>';
					document.getElementById('urgent').innerHTML = '<li class="loading">No digest available. Generate one first.</li>';
				}
			} catch (e) {
				showError('Failed to load dashboard: ' + e.message);
			}
		}
		function renderThemes(themes) {
			const container = document.getElementById('themes');
			if (!themes || themes.length === 0) {
				container.innerHTML = '<div class="loading">No themes data</div>';
				return;
			}
			const max = Math.max(...themes.map(t => t.count));
			container.innerHTML = themes.map(t => \`
				<div class="bar-item">
					<div class="bar-label" title="\${t.theme}">\${t.theme}</div>
					<div class="bar"><div class="bar-fill" style="width: \${(t.count / max) * 100}%"></div></div>
					<div class="bar-value">\${t.count}</div>
				</div>
			\`).join('');
		}
		function renderSentiment(sentiment) {
			const container = document.getElementById('sentiment');
			if (!sentiment || sentiment.length === 0) {
				container.innerHTML = '<div class="loading">No sentiment data</div>';
				return;
			}
			const max = Math.max(...sentiment.map(s => s.count));
			container.innerHTML = sentiment.map(s => \`
				<div class="bar-item">
					<div class="bar-label">\${s.sentiment}</div>
					<div class="bar"><div class="bar-fill" style="width: \${(s.count / max) * 100}%"></div></div>
					<div class="bar-value">\${s.count}</div>
				</div>
			\`).join('');
		}
		async function renderUrgent(urgentIds) {
			const container = document.getElementById('urgent');
			if (!urgentIds || urgentIds.length === 0) {
				container.innerHTML = '<li class="loading">No urgent items</li>';
				return;
			}
			try {
				const res = await fetch('/api/feedback?limit=1000');
				const allItems = await res.json();
				const urgentItems = allItems.filter(item => urgentIds.includes(item.id));
				if (urgentItems && urgentItems.length > 0) {
					container.innerHTML = urgentItems.map(item => \`
						<li class="urgent-item">
							<strong>\${item.title || 'Untitled'}</strong>
							<small>Source: \${item.source} • Theme: \${item.theme || '-'} • Sentiment: \${item.sentiment || '-'}</small>
							<div style="margin-top:6px;">\${item.content.substring(0, 110)}\${item.content.length > 110 ? '...' : ''}</div>
							<div style="margin-top:8px;">
								<a href="/feedback?urgency=high" style="color:#F38020; text-decoration:none; font-weight:700;">View all high urgency →</a>
							</div>
						</li>
					\`).join('');
				} else {
					container.innerHTML = '<li class="loading">No urgent items found</li>';
				}
			} catch (e) {
				container.innerHTML = '<li class="loading">Failed to load urgent items</li>';
			}
		}
		function showError(msg) {
			document.getElementById('error').innerHTML = \`<div class="error">\${msg}</div>\`;
			setTimeout(() => document.getElementById('error').innerHTML = '', 5000);
		}
		loadDashboard();
	</script>
</body>
</html>`;
	return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

async function handleFeedbackPage(env: Env, url: URL): Promise<Response> {
	const source = url.searchParams.get('source') || '';
	const sentiment = url.searchParams.get('sentiment') || '';
	const urgency = url.searchParams.get('urgency') || '';
	const q = url.searchParams.get('q') || '';

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Feedback - SignalBoard</title>
	<style>
		:root{
			--cf-orange:#F38020;
			--cf-orange-2:#FA9C2D;
			--bg:#F9FAFB;
			--card:#FFFFFF;
			--text:#111827;
			--muted:#6B7280;
			--border:#E5E7EB;
			--shadow-sm: 0 2px 10px rgba(17,24,39,0.06);
			--radius: 16px;
		}
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
			background: radial-gradient(1200px 600px at 20% -10%, rgba(243,128,32,0.12), transparent 55%),
									radial-gradient(900px 500px at 90% 0%, rgba(250,156,45,0.10), transparent 60%),
									var(--bg);
			padding: 24px;
			color: var(--text);
		}
		.container { max-width: 1400px; margin: 0 auto; }
		.topbar{
			display:flex;
			align-items:flex-start;
			justify-content:space-between;
			gap:16px;
			padding:16px 18px;
			border:1px solid var(--border);
			background: rgba(255,255,255,0.85);
			backdrop-filter: blur(8px);
			border-radius: var(--radius);
			box-shadow: var(--shadow-sm);
			margin-bottom: 18px;
		}
		.brand-title{
			font-weight: 800;
			font-size: 16px;
			line-height: 1.2;
		}
		.subtitle{
			font-size: 13px;
			color: var(--muted);
			margin-top: 4px;
		}
		.button-link{
			height: 38px;
			padding: 0 14px;
			border-radius: 12px;
			border: 1px solid var(--border);
			text-decoration:none;
			color: var(--text);
			background: white;
			display:inline-flex;
			align-items:center;
			font-weight: 700;
		}
		.card{
			background: var(--card);
			border: 1px solid var(--border);
			border-radius: var(--radius);
			box-shadow: var(--shadow-sm);
			padding: 16px;
		}
		.filters {
			display: flex;
			gap: 10px;
			flex-wrap: wrap;
			align-items: center;
		}
		.filters input, .filters select {
			height: 38px;
			padding: 0 12px;
			border: 1px solid var(--border);
			border-radius: 12px;
			font-size: 14px;
			background: white;
			color: var(--text);
		}
		.filters input { min-width: 200px; }
		.filters button {
			height: 38px;
			padding: 0 14px;
			background: linear-gradient(135deg, var(--cf-orange), var(--cf-orange-2));
			color: white;
			border: 1px solid transparent;
			border-radius: 12px;
			cursor: pointer;
			font-weight: 700;
			box-shadow: 0 10px 18px rgba(243,128,32,0.16);
		}
		.filters button:hover { filter: brightness(0.98); transform: translateY(-1px); }

		#table-container { margin-top: 16px; }
		table {
			width: 100%;
			border-collapse: separate;
			border-spacing: 0;
			overflow: hidden;
			border-radius: 14px;
			border: 1px solid var(--border);
			background: white;
		}
		th, td {
			padding: 12px;
			text-align: left;
			border-bottom: 1px solid #F3F4F6;
			vertical-align: top;
		}
		th {
			background: #F9FAFB;
			font-weight: 700;
			color: var(--muted);
			font-size: 12px;
			text-transform: uppercase;
			letter-spacing: .04em;
		}
		tr:hover { background: #FFF7ED; cursor: pointer; }
		.expanded { background: #FFF7ED; }
		.expanded-content {
			display: none;
			padding: 16px;
			background: #fff;
			border: 1px solid var(--border);
			border-radius: 14px;
			margin: 10px 0;
		}
		.expanded-content.show { display: block; }

		.badge {
			display: inline-block;
			padding: 4px 10px;
			border-radius: 999px;
			font-size: 12px;
			font-weight: 700;
			border: 1px solid rgba(17,24,39,0.08);
		}
		.badge-positive { background: rgba(34,197,94,0.12); color: #166534; }
		.badge-negative { background: rgba(239,68,68,0.12); color: #991B1B; }
		.badge-neutral  { background: rgba(59,130,246,0.10); color: #1D4ED8; }
		.badge-high     { background: rgba(239,68,68,0.12); color: #991B1B; }
		.badge-medium   { background: rgba(243,128,32,0.14); color: #9A3412; }
		.badge-low      { background: rgba(34,197,94,0.12); color: #166534; }
		.loading {
			text-align: center;
			padding: 32px;
			color: var(--muted);
		}
		.error {
			margin-top: 14px;
			padding: 10px 12px;
			border-radius: 14px;
			border: 1px solid rgba(239,68,68,0.35);
			background: rgba(239,68,68,0.08);
			color: #991B1B;
		}
		.small-muted { color: var(--muted); font-size: 12px; }
	</style>
</head>
<body>
	<div class="container">
		<div class="topbar">
			<div>
				<div class="brand-title">SignalBoard</div>
				<div class="subtitle">Raw feedback explorer</div>
			</div>
			<a class="button-link" href="/">← Back to Dashboard</a>
		</div>
		<div class="card">
			<div class="filters">
				<input type="text" id="source" placeholder="Source (email / slack / support)" value="${source}">
				<select id="sentiment">
					<option value="">All Sentiments</option>
					<option value="positive" ${sentiment === 'positive' ? 'selected' : ''}>Positive</option>
					<option value="negative" ${sentiment === 'negative' ? 'selected' : ''}>Negative</option>
					<option value="neutral" ${sentiment === 'neutral' ? 'selected' : ''}>Neutral</option>
				</select>
				<select id="urgency">
					<option value="">All Urgencies</option>
					<option value="high" ${urgency === 'high' ? 'selected' : ''}>High</option>
					<option value="medium" ${urgency === 'medium' ? 'selected' : ''}>Medium</option>
					<option value="low" ${urgency === 'low' ? 'selected' : ''}>Low</option>
				</select>
				<input type="text" id="q" placeholder="Search title/content..." value="${q}">
				<button onclick="applyFilters()">Apply</button>
				<span class="small-muted">Tip: click a row to expand</span>
			</div>

			<div id="error"></div>
			<div id="table-container">
				<div class="loading">Loading feedback...</div>
			</div>
		</div>
	</div>
	<script>
		let expandedRow = null;
		async function loadFeedback() {
			const params = new URLSearchParams();
			const source = document.getElementById('source').value;
			const sentiment = document.getElementById('sentiment').value;
			const urgency = document.getElementById('urgency').value;
			const q = document.getElementById('q').value;

			if (source) params.append('source', source);
			if (sentiment) params.append('sentiment', sentiment);
			if (urgency) params.append('urgency', urgency);
			if (q) params.append('q', q);

			try {
				const res = await fetch('/api/feedback?' + params.toString());
				const data = await res.json();
				if (res.ok) {
					renderTable(data);
				} else {
					showError(data.error || 'Failed to load feedback');
				}
			} catch (e) {
				showError('Failed to load feedback: ' + e.message);
			}
		}
		function renderTable(items) {
			const container = document.getElementById('table-container');
			if (!items || items.length === 0) {
				container.innerHTML = '<div class="loading">No feedback found</div>';
				return;
			}
			const html = \`
				<table>
					<thead>
						<tr>
							<th style="width:70px;">ID</th>
							<th style="width:110px;">Source</th>
							<th>Title</th>
							<th style="width:140px;">Sentiment</th>
							<th style="width:130px;">Urgency</th>
							<th style="width:180px;">Theme</th>
							<th style="width:140px;">Date</th>
						</tr>
					</thead>
					<tbody>
						\${items.map(item => \`
							<tr class="\${expandedRow === item.id ? 'expanded' : ''}" onclick="toggleRow(\${item.id})">
								<td>\${item.id}</td>
								<td>\${item.source}</td>
								<td>\${item.title || '-'}</td>
								<td>\${renderBadge(item.sentiment, 'sentiment')}</td>
								<td>\${renderBadge(item.urgency, 'urgency')}</td>
								<td>\${item.theme || '-'}</td>
								<td>\${new Date(item.created_at).toLocaleDateString()}</td>
							</tr>
							<tr>
								<td colspan="7">
									<div class="expanded-content \${expandedRow === item.id ? 'show' : ''}" id="content-\${item.id}">
										<div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:10px;">
											<div style="font-weight:800; font-size:16px;">\${item.title || 'Untitled'}</div>
											<div class="small-muted">ID: \${item.id} • \${item.source} • \${new Date(item.created_at).toLocaleString()}</div>
										</div>
										<div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;">
											<div>\${renderBadge(item.sentiment, 'sentiment')}</div>
											<div>\${renderBadge(item.urgency, 'urgency')}</div>
											<div class="small-muted">Theme: <strong>\${item.theme || '-'}</strong></div>
										</div>
										<p style="margin: 10px 0;"><strong>Content</strong></p>
										<p style="line-height:1.5;">\${item.content}</p>
										<p style="margin-top: 12px;"><strong>Tags</strong></p>
										<p class="small-muted">\${item.tags || 'None'}</p>
									</div>
								</td>
							</tr>
						\`).join('')}
					</tbody>
				</table>
			\`;
			container.innerHTML = html;
		}
		function renderBadge(value, type) {
			if (!value) return '-';
			const classes = {
				sentiment: {
					positive: 'badge-positive',
					negative: 'badge-negative',
					neutral: 'badge-neutral'
				},
				urgency: {
					high: 'badge-high',
					medium: 'badge-medium',
					low: 'badge-low'
				}
			};
			const key = String(value).toLowerCase();
			const cls = classes[type]?.[key] || '';
			return \`<span class="badge \${cls}">\${value}</span>\`;
		}

		function toggleRow(id) {
			expandedRow = (expandedRow === id) ? null : id;

			document.querySelectorAll('tr.expanded').forEach(row => row.classList.remove('expanded'));
			document.querySelectorAll('.expanded-content').forEach(content => content.classList.remove('show'));

			if (expandedRow) {
				const row = document.querySelector(\`tr[onclick="toggleRow(\${expandedRow})"]\`);
				const content = document.getElementById(\`content-\${expandedRow}\`);
				if (row) row.classList.add('expanded');
				if (content) content.classList.add('show');
			}
		}
		function applyFilters() {
			const params = new URLSearchParams();
			const source = document.getElementById('source').value;
			const sentiment = document.getElementById('sentiment').value;
			const urgency = document.getElementById('urgency').value;
			const q = document.getElementById('q').value;
			if (source) params.append('source', source);
			if (sentiment) params.append('sentiment', sentiment);
			if (urgency) params.append('urgency', urgency);
			if (q) params.append('q', q);
			window.location.href = '/feedback?' + params.toString();
		}
		function showError(msg) {
			document.getElementById('error').innerHTML = \`<div class="error">\${msg}</div>\`;
			setTimeout(() => document.getElementById('error').innerHTML = '', 5000);
		}
		loadFeedback();
	</script>
</body>
</html>`;

	return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}

// API Handlers
async function handleSeed(env: Env): Promise<Response> {
	// Mock data includes pre-labeled metadata so seeding is reliable + fast (no AI calls).
	const now = new Date();

	const mockData: Array<{
		source: string;
		title: string;
		content: string;
		theme: string;
		sentiment: 'positive' | 'neutral' | 'negative';
		urgency: 'low' | 'medium' | 'high';
		tags: string[];
	}> = [
		{
			source: 'email',
			title: 'Dark mode request',
			content: 'Can we add dark mode to the app? It would be great for night usage.',
			theme: 'UI & Accessibility',
			sentiment: 'neutral',
			urgency: 'low',
			tags: ['ui', 'accessibility', 'feature-request'],
		},
		{
			source: 'slack',
			title: 'Login broken on mobile',
			content: 'The login button is not working on mobile devices. Users are unable to access their accounts.',
			theme: 'Auth & Login',
			sentiment: 'negative',
			urgency: 'high',
			tags: ['bug', 'mobile', 'auth'],
		},
		{
			source: 'support',
			title: 'Dashboard slow',
			content: 'The dashboard is loading very slowly. It takes over 10 seconds to load.',
			theme: 'Performance',
			sentiment: 'negative',
			urgency: 'high',
			tags: ['performance', 'dashboard'],
		},
		{
			source: 'email',
			title: 'Great update!',
			content: 'Love the new update! The UI improvements are fantastic.',
			theme: 'General Feedback',
			sentiment: 'positive',
			urgency: 'low',
			tags: ['praise', 'ui'],
		},
		{
			source: 'slack',
			title: 'Salesforce integration',
			content: 'We need to integrate with Salesforce. This is critical for our sales team.',
			theme: 'Integrations',
			sentiment: 'neutral',
			urgency: 'high',
			tags: ['integration', 'salesforce'],
		},
		{
			source: 'support',
			title: 'Password reset email never arrives',
			content: 'I cannot reset my password. The reset email never arrives.',
			theme: 'Auth & Login',
			sentiment: 'negative',
			urgency: 'high',
			tags: ['auth', 'email', 'bug'],
		},
		{
			source: 'email',
			title: 'Navigation is confusing',
			content: 'The navigation menu could be more intuitive. Consider adding breadcrumbs.',
			theme: 'UI & Navigation',
			sentiment: 'negative',
			urgency: 'medium',
			tags: ['ui', 'navigation'],
		},
		{
			source: 'slack',
			title: 'CSV export needed',
			content: 'We need the ability to export reports in CSV format.',
			theme: 'Reporting',
			sentiment: 'neutral',
			urgency: 'medium',
			tags: ['export', 'reporting', 'csv'],
		},
		{
			source: 'support',
			title: 'Security concern in auth',
			content: 'I noticed a potential security vulnerability in the API authentication.',
			theme: 'Security',
			sentiment: 'negative',
			urgency: 'high',
			tags: ['security', 'api', 'auth'],
		},
		{
			source: 'email',
			title: 'Mobile app availability',
			content: 'When will the mobile app be available? This is highly requested by our users.',
			theme: 'Mobile',
			sentiment: 'neutral',
			urgency: 'medium',
			tags: ['mobile', 'roadmap'],
		},
		{
			source: 'slack',
			title: 'Notification settings',
			content: 'Users want more granular control over notification preferences.',
			theme: 'Notifications',
			sentiment: 'neutral',
			urgency: 'low',
			tags: ['notifications', 'settings'],
		},
		{
			source: 'support',
			title: 'Double charged',
			content: 'My payment was charged twice. Please refund the duplicate charge.',
			theme: 'Billing',
			sentiment: 'negative',
			urgency: 'high',
			tags: ['billing', 'payments', 'bug'],
		},
		{
			source: 'email',
			title: 'Docs outdated',
			content: 'The API documentation needs to be updated with the latest endpoints.',
			theme: 'Docs & Onboarding',
			sentiment: 'negative',
			urgency: 'medium',
			tags: ['docs', 'api', 'developer-experience'],
		},
		{
			source: 'slack',
			title: 'Search irrelevant',
			content: 'The search functionality is not returning relevant results.',
			theme: 'Search',
			sentiment: 'negative',
			urgency: 'medium',
			tags: ['search', 'relevance'],
		},
		{
			source: 'support',
			title: 'Need admin access',
			content: 'I need admin access to manage team members.',
			theme: 'Admin & RBAC',
			sentiment: 'neutral',
			urgency: 'medium',
			tags: ['rbac', 'admin'],
		},
		{
			source: 'email',
			title: 'Analytics dashboard is excellent',
			content: 'The new analytics dashboard is excellent! Great work team.',
			theme: 'Analytics',
			sentiment: 'positive',
			urgency: 'low',
			tags: ['analytics', 'praise'],
		},
		{
			source: 'slack',
			title: 'Zapier webhooks not firing',
			content: 'The Zapier integration is broken. Webhooks are not firing.',
			theme: 'Integrations',
			sentiment: 'negative',
			urgency: 'high',
			tags: ['zapier', 'webhooks', 'bug'],
		},
		{
			source: 'support',
			title: 'Pricing tiers confusing',
			content: 'Can you explain the pricing tiers? I am confused about the differences.',
			theme: 'Billing',
			sentiment: 'negative',
			urgency: 'medium',
			tags: ['billing', 'pricing', 'docs'],
		},
		{
			source: 'email',
			title: 'Screen reader support',
			content: 'The app needs better screen reader support for accessibility compliance.',
			theme: 'UI & Accessibility',
			sentiment: 'negative',
			urgency: 'medium',
			tags: ['accessibility', 'a11y'],
		},
		{
			source: 'slack',
			title: 'iOS crashes frequently',
			content: 'The app crashes frequently on iOS devices. This is urgent.',
			theme: 'Mobile',
			sentiment: 'negative',
			urgency: 'high',
			tags: ['ios', 'crash', 'bug'],
		},
	];

	let inserted = 0;

	for (let i = 0; i < mockData.length; i++) {
		const item = mockData[i];
		// Stagger timestamps across the last ~10 days so daily/weekly/monthly digests look meaningful
		const createdAt = new Date(now);
		createdAt.setDate(now.getDate() - (i % 10));
		createdAt.setHours(9 + (i % 8), 0, 0, 0);

		try {
			await env.signalboard_db
				.prepare(
					`INSERT INTO feedback (source, title, content, created_at, theme, sentiment, urgency, tags)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.bind(
					item.source,
					item.title,
					item.content,
					createdAt.toISOString(),
					item.theme,
					item.sentiment,
					item.urgency,
					JSON.stringify(item.tags)
				)
				.run();
			inserted++;
		} catch (error) {
			console.error(`Failed to insert item: ${item.title}`, error);
		}
	}

	return jsonResponse({ message: `Inserted ${inserted} mock feedback items (no AI calls)` });
}

async function handleCreateFeedback(request: Request, env: Env): Promise<Response> {
	const body = await request.json() as {
		source: string;
		title?: string;
		content: string;
		created_at?: string;
	};

	if (!body.source || !body.content) {
		return jsonResponse({ error: 'source and content are required' }, 400);
	}

	try {
		// Classify with AI
		const classification = await classifyFeedback(env, body.content);

		const createdAt = body.created_at || new Date().toISOString();
		const result = await env.signalboard_db.prepare(
			`INSERT INTO feedback (source, title, content, created_at, theme, sentiment, urgency, tags)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			 RETURNING *`
		)
			.bind(
				body.source,
				body.title || null,
				body.content,
				createdAt,
				classification.theme,
				classification.sentiment,
				classification.urgency,
				JSON.stringify(classification.tags)
			)
			.first<FeedbackRow>();

		return jsonResponse(result);
	} catch (error) {
		console.error('Error creating feedback:', error);
		return jsonResponse(
			{ error: error instanceof Error ? error.message : 'Failed to create feedback' },
			500
		);
	}
}

async function handleGetFeedback(env: Env, url: URL): Promise<Response> {
	const source = url.searchParams.get('source');
	const sentiment = url.searchParams.get('sentiment');
	const urgency = url.searchParams.get('urgency');
	const q = url.searchParams.get('q');
	const limit = parseInt(url.searchParams.get('limit') || '100');

	let query = 'SELECT * FROM feedback WHERE 1=1';
	const binds: any[] = [];

	if (source) {
		query += ' AND source = ?';
		binds.push(source);
	}
	if (sentiment) {
		query += ' AND sentiment = ?';
		binds.push(sentiment);
	}
	if (urgency) {
		query += ' AND urgency = ?';
		binds.push(urgency);
	}
	if (q) {
		query += ' AND (content LIKE ? OR title LIKE ?)';
		const searchTerm = `%${q}%`;
		binds.push(searchTerm, searchTerm);
	}

	query += ' ORDER BY created_at DESC LIMIT ?';
	binds.push(limit);

	try {
		const stmt = env.signalboard_db.prepare(query).bind(...binds);
		const result = await stmt.all<FeedbackRow>();

		// IMPORTANT: D1 returns an object; the rows are in result.results
		return jsonResponse(result.results || []);
	} catch (error) {
		console.error('Error fetching feedback:', error);
		return jsonResponse(
			{ error: error instanceof Error ? error.message : 'Failed to fetch feedback' },
			500
		);
	}
}

async function handleCreateDigest(request: Request, env: Env): Promise<Response> {
	const body = await request.json() as { cadence: string };

	if (!body.cadence || !['daily', 'weekly', 'monthly'].includes(body.cadence)) {
		return jsonResponse({ error: 'cadence must be daily, weekly, or monthly' }, 400);
	}

	try {
		// Calculate time window
		const now = new Date();
		let periodStart: Date;
		if (body.cadence === 'daily') {
			periodStart = new Date(now);
			periodStart.setHours(0, 0, 0, 0);
		} else if (body.cadence === 'weekly') {
			periodStart = new Date(now);
			periodStart.setDate(now.getDate() - 7);
		} else {
			periodStart = new Date(now);
			periodStart.setMonth(now.getMonth() - 1);
		}

		// Fetch feedback in time window
		const feedback = await env.signalboard_db.prepare(
			`SELECT * FROM feedback WHERE created_at >= ? ORDER BY created_at DESC`
		)
			.bind(periodStart.toISOString())
			.all<FeedbackRow>();

		if (!feedback.results || feedback.results.length === 0) {
			return jsonResponse({ error: 'No feedback found in the specified time window' }, 404);
		}

		// Generate digest with AI
		const digest = await generateDigest(env, feedback.results);

		// Store digest
		const result = await env.signalboard_db.prepare(
			`INSERT INTO digests (cadence, period_start, period_end, summary, themes_json, sentiment_json, urgent_ids_json, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			 RETURNING *`
		)
			.bind(
				body.cadence,
				periodStart.toISOString(),
				now.toISOString(),
				digest.executive_summary,
				JSON.stringify(digest.top_themes),
				JSON.stringify(digest.sentiment_breakdown),
				JSON.stringify(digest.urgent_ids),
				now.toISOString()
			)
			.first<DigestRow>();

		if (!result) {
			return jsonResponse({ error: 'Failed to create digest' }, 500);
		}

		return jsonResponse({
			id: result.id,
			cadence: result.cadence,
			executive_summary: digest.executive_summary,
			top_themes: digest.top_themes,
			sentiment_breakdown: digest.sentiment_breakdown,
			urgent_ids: digest.urgent_ids,
		});
	} catch (error) {
		console.error('Error creating digest:', error);
		return jsonResponse(
			{ error: error instanceof Error ? error.message : 'Failed to create digest' },
			500
		);
	}
}

async function handleGetDigest(env: Env, url: URL): Promise<Response> {
	const cadence = url.searchParams.get('cadence') || 'daily';

	try {
		const result = await env.signalboard_db.prepare(
			`SELECT * FROM digests WHERE cadence = ? ORDER BY created_at DESC LIMIT 1`
		)
			.bind(cadence)
			.first<DigestRow>();

		if (!result) {
			return jsonResponse({ error: 'No digest found for the specified cadence' }, 404);
		}

		return jsonResponse({
			id: result.id,
			cadence: result.cadence,
			executive_summary: result.summary,
			top_themes: JSON.parse(result.themes_json),
			sentiment_breakdown: JSON.parse(result.sentiment_json),
			urgent_ids: JSON.parse(result.urgent_ids_json),
		});
	} catch (error) {
		console.error('Error fetching digest:', error);
		return jsonResponse(
			{ error: error instanceof Error ? error.message : 'Failed to fetch digest' },
			500
		);
	}
}

// AI Functions
async function classifyFeedback(env: Env, content: string): Promise<ClassificationResult> {
	const prompt = `Analyze the following feedback and return ONLY a valid JSON object with this exact structure:
{
  "theme": "a single word or short phrase describing the main theme (e.g., "feature_request", "bug", "performance", "ui", "integration")",
  "sentiment": "one of: positive, negative, neutral",
  "urgency": "one of: high, medium, low",
  "tags": ["array", "of", "relevant", "tags"]
}

Feedback: ${content}

Return ONLY the JSON object, no other text.`;

	try {
		const response = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
			messages: [
				{
					role: 'user',
					content: prompt,
				},
			],
			max_tokens: 200,
		});

		const output = response as { response?: string };
		const text = output.response || '';
		if (!text) {
			throw new Error('No response from AI');
		}

		// Extract JSON from response (handle markdown code blocks)
		const fallback: ClassificationResult = {
			theme: 'General Feedback',
			sentiment: 'neutral',
			urgency: 'low',
			tags: ['misc'],
		};
		
		const jsonStr = extractFirstJsonObject(text);
		if (!jsonStr) return fallback;
		
		const parsed = tryParseJson<ClassificationResult>(jsonStr);
		if (!parsed) return fallback;
		
		// Normalize + validate enums
		const sentiment = (parsed.sentiment || '').toLowerCase();
		const urgency = (parsed.urgency || '').toLowerCase();
		
		return {
			theme: parsed.theme?.trim() || fallback.theme,
			sentiment: sentiment === 'positive' || sentiment === 'negative' || sentiment === 'neutral' ? sentiment : fallback.sentiment,
			urgency: urgency === 'high' || urgency === 'medium' || urgency === 'low' ? urgency : fallback.urgency,
			tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : fallback.tags,
		};
		
	} catch (error) {
		console.error('AI classification error:', error);
		// Fallback to defaults
		return {
			theme: 'general',
			sentiment: 'neutral',
			urgency: 'medium',
			tags: [],
		};
	}
}

async function generateDigest(env: Env, feedback: FeedbackRow[]): Promise<DigestResult> {
	// Prepare feedback summary for AI
	const feedbackSummary = feedback.map((f, i) => 
		`${i + 1}. [ID:${f.id}] ${f.title || 'Untitled'}: ${f.content.substring(0, 200)}...`
	).join('\n');

	const prompt = `Analyze the following feedback items and generate a digest. Return ONLY a valid JSON object with this exact structure:
{
  "executive_summary": "a 2-3 sentence summary of the overall feedback",
  "top_themes": [{"theme": "theme_name", "count": number}, ...],
  "sentiment_breakdown": [{"sentiment": "positive|negative|neutral", "count": number}, ...],
  "urgent_ids": [array of feedback IDs that are urgent]
}

Feedback items:
${feedbackSummary}

Return ONLY the JSON object, no other text.`;

	try {
		const response = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
			messages: [
				{
					role: 'user',
					content: prompt,
				},
			],
			max_tokens: 500,
		});

		const output = response as { response?: string };
		const text = output.response || '';
		if (!text) {
			throw new Error('No response from AI');
		}

		// Extract JSON from response
		const jsonStr = extractFirstJsonObject(text);
		if (!jsonStr) throw new Error('No JSON object found in AI response');

		const parsed = tryParseJson<DigestResult>(jsonStr);
		if (!parsed) throw new Error('Failed to parse AI digest JSON');

		// Ensure arrays are arrays
		if (!Array.isArray(parsed.top_themes)) parsed.top_themes = [];
		if (!Array.isArray(parsed.sentiment_breakdown)) parsed.sentiment_breakdown = [];
		if (!Array.isArray(parsed.urgent_ids)) parsed.urgent_ids = [];

		return parsed;

	} catch (error) {
		console.error('AI digest generation error:', error);
	
		// Better fallback: compute themes + sentiment + urgent directly
		const themes: Record<string, number> = {};
		const sentiments: Record<string, number> = { positive: 0, neutral: 0, negative: 0 };
		const urgentIds: number[] = [];
	
		for (const f of feedback) {
			const theme = f.theme || 'General Feedback';
			themes[theme] = (themes[theme] || 0) + 1;
	
			const s = (f.sentiment || 'neutral').toLowerCase();
			if (s === 'positive' || s === 'neutral' || s === 'negative') sentiments[s]++;
	
			const u = (f.urgency || '').toLowerCase();
			if (u === 'high') urgentIds.push(f.id);
		}
	
		const topThemes = Object.entries(themes)
			.map(([theme, count]) => ({ theme, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 5);
	
		return {
			executive_summary: `Summary of ${feedback.length} feedback items collected (fallback digest).`,
			top_themes: topThemes,
			sentiment_breakdown: [
				{ sentiment: 'positive', count: sentiments.positive },
				{ sentiment: 'neutral', count: sentiments.neutral },
				{ sentiment: 'negative', count: sentiments.negative },
			],
			urgent_ids: urgentIds.slice(0, 10),
		};
	}
}

function extractFirstJsonObject(text: string): string | null {
	const start = text.indexOf('{');
	const end = text.lastIndexOf('}');
	if (start === -1 || end === -1 || end <= start) return null;
	return text.slice(start, end + 1);
}

function tryParseJson<T>(raw: string): T | null {
	// 1) Direct parse
	try {
		return JSON.parse(raw) as T;
	} catch {}

	// 2) Common small repairs (curly quotes, trailing commas)
	const repaired = raw
		.replace(/“|”/g, '"')
		.replace(/‘|’/g, "'")
		.replace(/,\s*}/g, '}')
		.replace(/,\s*]/g, ']');

	try {
		return JSON.parse(repaired) as T;
	} catch {}

	return null;
}

// Helper function
function jsonResponse(data: any, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			'Content-Type': 'application/json',
		},
	});
}
