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
	<title>Signalboard Dashboard</title>
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
			background: #f5f5f5;
			padding: 20px;
			color: #333;
		}
		.container {
			max-width: 1200px;
			margin: 0 auto;
			background: white;
			border-radius: 8px;
			padding: 30px;
			box-shadow: 0 2px 4px rgba(0,0,0,0.1);
		}
		h1 { margin-bottom: 30px; color: #1a1a1a; }
		.controls {
			display: flex;
			gap: 15px;
			margin-bottom: 30px;
			flex-wrap: wrap;
			align-items: center;
		}
		select, button {
			padding: 10px 15px;
			border: 1px solid #ddd;
			border-radius: 4px;
			font-size: 14px;
			cursor: pointer;
		}
		select {
			background: white;
		}
		button {
			background: #0070f3;
			color: white;
			border: none;
			font-weight: 500;
		}
		button:hover {
			background: #0051cc;
		}
		button:disabled {
			background: #ccc;
			cursor: not-allowed;
		}
		.section {
			margin-bottom: 40px;
		}
		.section h2 {
			margin-bottom: 15px;
			color: #333;
			font-size: 20px;
		}
		.bar-chart {
			display: flex;
			flex-direction: column;
			gap: 10px;
		}
		.bar-item {
			display: flex;
			align-items: center;
			gap: 10px;
		}
		.bar-label {
			min-width: 150px;
			font-size: 14px;
		}
		.bar {
			flex: 1;
			height: 30px;
			background: #e0e0e0;
			border-radius: 4px;
			position: relative;
			overflow: hidden;
		}
		.bar-fill {
			height: 100%;
			background: #0070f3;
			transition: width 0.3s;
		}
		.bar-value {
			position: absolute;
			right: 10px;
			top: 50%;
			transform: translateY(-50%);
			font-size: 12px;
			font-weight: 600;
		}
		.urgent-list {
			list-style: none;
		}
		.urgent-item {
			padding: 12px;
			background: #fff3cd;
			border-left: 4px solid #ffc107;
			margin-bottom: 10px;
			border-radius: 4px;
		}
		.urgent-item strong {
			display: block;
			margin-bottom: 5px;
		}
		.loading {
			text-align: center;
			padding: 20px;
			color: #666;
		}
		.error {
			background: #fee;
			color: #c33;
			padding: 10px;
			border-radius: 4px;
			margin-bottom: 20px;
		}
		.link {
			color: #0070f3;
			text-decoration: none;
			margin-left: 20px;
		}
		.link:hover {
			text-decoration: underline;
		}
	</style>
</head>
<body>
	<div class="container">
		<h1>Signalboard Dashboard</h1>
		<div class="controls">
			<select id="cadence">
				<option value="daily">Daily</option>
				<option value="weekly">Weekly</option>
				<option value="monthly">Monthly</option>
			</select>
			<button onclick="seedData()">Seed Mock Data</button>
			<button onclick="generateDigest()">Generate Digest</button>
			<a href="/feedback" class="link">View Feedback</a>
		</div>
		<div id="error"></div>
		<div class="section">
			<h2>Top Themes</h2>
			<div id="themes" class="bar-chart">
				<div class="loading">Loading themes...</div>
			</div>
		</div>
		<div class="section">
			<h2>Sentiment</h2>
			<div id="sentiment" class="bar-chart">
				<div class="loading">Loading sentiment...</div>
			</div>
		</div>
		<div class="section">
			<h2>Urgent Items</h2>
			<ul id="urgent" class="urgent-list">
				<li class="loading">Loading urgent items...</li>
			</ul>
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
				if (digest) {
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
					<div class="bar-label">\${t.theme}</div>
					<div class="bar">
						<div class="bar-fill" style="width: \${(t.count / max) * 100}%"></div>
						<div class="bar-value">\${t.count}</div>
					</div>
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
					<div class="bar">
						<div class="bar-fill" style="width: \${(s.count / max) * 100}%"></div>
						<div class="bar-value">\${s.count}</div>
					</div>
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
				// Fetch all feedback and filter by urgent IDs
				const res = await fetch('/api/feedback?limit=1000');
				const allItems = await res.json();
				const urgentItems = allItems.filter(item => urgentIds.includes(item.id));
				if (urgentItems && urgentItems.length > 0) {
					container.innerHTML = urgentItems.map(item => \`
						<li class="urgent-item">
							<strong>\${item.title || 'Untitled'}</strong>
							<div>\${item.content.substring(0, 100)}\${item.content.length > 100 ? '...' : ''}</div>
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
	return new Response(html, {
		headers: { 'Content-Type': 'text/html' },
	});
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
	<title>Feedback - Signalboard</title>
	<style>
		* { margin: 0; padding: 0; box-sizing: border-box; }
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
			background: #f5f5f5;
			padding: 20px;
			color: #333;
		}
		.container {
			max-width: 1400px;
			margin: 0 auto;
			background: white;
			border-radius: 8px;
			padding: 30px;
			box-shadow: 0 2px 4px rgba(0,0,0,0.1);
		}
		h1 { margin-bottom: 30px; }
		.filters {
			display: flex;
			gap: 15px;
			margin-bottom: 20px;
			flex-wrap: wrap;
		}
		.filters input, .filters select {
			padding: 8px 12px;
			border: 1px solid #ddd;
			border-radius: 4px;
			font-size: 14px;
		}
		.filters button {
			padding: 8px 16px;
			background: #0070f3;
			color: white;
			border: none;
			border-radius: 4px;
			cursor: pointer;
		}
		.filters button:hover {
			background: #0051cc;
		}
		table {
			width: 100%;
			border-collapse: collapse;
			margin-top: 20px;
		}
		th, td {
			padding: 12px;
			text-align: left;
			border-bottom: 1px solid #eee;
		}
		th {
			background: #f8f9fa;
			font-weight: 600;
		}
		tr:hover {
			background: #f8f9fa;
			cursor: pointer;
		}
		.expanded {
			background: #fff9e6;
		}
		.expanded-content {
			display: none;
			padding: 20px;
			background: #fff;
			border: 1px solid #ddd;
			border-radius: 4px;
			margin-top: 10px;
		}
		.expanded-content.show {
			display: block;
		}
		.badge {
			display: inline-block;
			padding: 4px 8px;
			border-radius: 4px;
			font-size: 12px;
			font-weight: 500;
		}
		.badge-positive { background: #d4edda; color: #155724; }
		.badge-negative { background: #f8d7da; color: #721c24; }
		.badge-neutral { background: #d1ecf1; color: #0c5460; }
		.badge-high { background: #f8d7da; color: #721c24; }
		.badge-medium { background: #fff3cd; color: #856404; }
		.badge-low { background: #d4edda; color: #155724; }
		.loading {
			text-align: center;
			padding: 40px;
			color: #666;
		}
		.error {
			background: #fee;
			color: #c33;
			padding: 10px;
			border-radius: 4px;
			margin-bottom: 20px;
		}
	</style>
</head>
<body>
	<div class="container">
		<h1>Feedback</h1>
		<div class="filters">
			<input type="text" id="source" placeholder="Source" value="${source}">
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
			<input type="text" id="q" placeholder="Search..." value="${q}">
			<button onclick="applyFilters()">Filter</button>
		</div>
		<div id="error"></div>
		<div id="table-container">
			<div class="loading">Loading feedback...</div>
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
							<th>ID</th>
							<th>Source</th>
							<th>Title</th>
							<th>Sentiment</th>
							<th>Urgency</th>
							<th>Theme</th>
							<th>Date</th>
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
										<h3>\${item.title || 'Untitled'}</h3>
										<p><strong>Content:</strong></p>
										<p>\${item.content}</p>
										<p><strong>Tags:</strong> \${item.tags || 'None'}</p>
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
			const cls = classes[type]?.[value.toLowerCase()] || '';
			return \`<span class="badge \${cls}">\${value}</span>\`;
		}
		function toggleRow(id) {
			if (expandedRow === id) {
				expandedRow = null;
			} else {
				expandedRow = id;
			}
			// Update UI without reloading
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
	return new Response(html, {
		headers: { 'Content-Type': 'text/html' },
	});
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
		let stmt = env.signalboard_db.prepare(query);
		for (let i = 0; i < binds.length; i++) {
			stmt = stmt.bind(binds[i]);
		}
		const result = await stmt.all<FeedbackRow>();
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
