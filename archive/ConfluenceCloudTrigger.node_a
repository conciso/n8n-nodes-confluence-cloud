import {
	INodeType,
	INodeTypeDescription,
	IPollFunctions,
	INodeExecutionData,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';

export class ConfluenceCloudTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Confluence Cloud Trigger',
		name: 'confluenceCloudTrigger',
		icon: 'file:confluence.svg',
		group: ['trigger'],
		version: 1,
		description: 'Poll for new/updated Confluence content',
		polling: true,
		defaults: {
			name: 'Confluence Cloud Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'confluenceCloudApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Query Type',
				name: 'queryType',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Templates',
						value: 'template',
						description: 'Use predefined filters (recommended)',
					},
					{
						name: 'Custom CQL',
						value: 'cql',
						description: 'Write your own Confluence Query Language expression',
					},
				],
				default: 'template',
				description: 'How to define what content to monitor',
			},
			{
				displayName: 'Template',
				name: 'template',
				type: 'options',
				displayOptions: {
					show: {
						queryType: ['template'],
					},
				},
				options: [
					{
						name: 'New Pages',
						value: 'new_pages',
						description: 'Monitor newly created pages',
					},
					{
						name: 'Updated Pages',
						value: 'updated_pages',
						description: 'Monitor pages that have been modified',
					},
					{
						name: 'New or Updated Pages',
						value: 'new_or_updated_pages',
						description: 'Monitor all page changes (created or modified)',
					},
				],
				default: 'new_or_updated_pages',
				description: 'What type of content changes to monitor',
			},
			
			// Filter Fields - immer verfügbar bei Templates
			{
				displayName: 'Space Keys (Optional)',
				name: 'spaceKeys',
				type: 'string',
				displayOptions: {
					show: {
						queryType: ['template'],
					},
				},
				default: '',
				placeholder: 'DOCS, TEAM, HELP',
				description: 'Comma-separated list of space keys to monitor. Leave empty for all spaces.',
			},
			{
				displayName: 'Labels (Optional)',
				name: 'labels',
				type: 'string',
				displayOptions: {
					show: {
						queryType: ['template'],
					},
				},
				default: '',
				placeholder: 'urgent, review, draft',
				description: 'Comma-separated list of labels to filter by. Leave empty for all labels.',
			},
			{
				displayName: 'Author (Optional)',
				name: 'author',
				type: 'string',
				displayOptions: {
					show: {
						queryType: ['template'],
					},
				},
				default: '',
				placeholder: '99:27935d01-XXXX-XXXX-XXXX-a9b8d3b2ae2e',
				description: 'Confluence Account ID of the author (not email or username). Leave empty for all authors.',
			},
			{
				displayName: 'Initial Lookback',
				name: 'initialLookback',
				type: 'options',
				displayOptions: {
					show: {
						queryType: ['template'],
					},
				},
				// eslint-disable-next-line n8n-nodes-base/node-param-options-type-unsorted-items
				options: [
					{ name: '1 Hour', value: '1h' },
					{ name: '6 Hours', value: '6h' },
					{ name: '12 Hours', value: '12h' },
					{ name: '1 Day', value: '1d' },
					{ name: '3 Days', value: '3d' },
					{ name: '1 Week', value: '1w' },
					{ name: '2 Weeks', value: '2w' },
					{ name: '1 Month', value: '4w' },
				],
				default: '1h',
				description: 'How far back to look for content on first run',
			},
			{
				displayName: 'CQL Query',
				name: 'cqlQuery',
				type: 'string',
				typeOptions: {
					rows: 5,
				},
				displayOptions: {
					show: {
						queryType: ['cql'],
					},
				},
				default: '',
				placeholder: 'space in ("DOCS", "TEAM") AND type = page AND created >= now()-24h',
				description: 'Write your Confluence Query Language expression',
			},
			{
				displayName: 'Additional Options',
				name: 'additionalOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Result Limit',
						name: 'limit',
						type: 'number',
						typeOptions: {
							minValue: 1,
						},
						default: 50,
						description: 'Max number of results to return',
					},
					{
						displayName: 'Include Drafts',
						name: 'includeDrafts',
						type: 'boolean',
						default: false,
						description: 'Whether to include draft pages in results',
					},
					{
						displayName: 'Reset Trigger State',
						name: 'resetState',
						type: 'boolean',
						default: false,
						description: 'Whether to reset the trigger state and start fresh (will re-trigger for all matching content)',
					},
				],
			},
		],
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][]> {
		const queryType = this.getNodeParameter('queryType') as string;
		const additionalOptions = this.getNodeParameter('additionalOptions', {}) as any;

		// Build CQL query
		let finalQuery = '';
		let triggerEventType = 'created_or_updated'; // Default for output

		if (queryType === 'template') {
			const template = this.getNodeParameter('template') as string;
			const spaceKeys = this.getNodeParameter('spaceKeys', '') as string;
			const labels = this.getNodeParameter('labels', '') as string;
			const author = this.getNodeParameter('author', '') as string;
			const initialLookback = this.getNodeParameter('initialLookback', '1h') as string;
			
			// Base query with filters
			let baseConditions = ['type = page'];
			
			// Add space filter if specified
			if (spaceKeys.trim()) {
				const spaces = spaceKeys.split(',').map(s => `"${s.trim()}"`).join(', ');
				baseConditions.push(`space in (${spaces})`);
			}
			
			// Add label filter if specified
			if (labels.trim()) {
				const labelConditions = labels.split(',').map(l => `label = "${l.trim()}"`).join(' OR ');
				baseConditions.push(`(${labelConditions})`);
			}
			
			// Add author filter if specified
			if (author.trim()) {
				baseConditions.push(`creator = "${author.trim()}"`);
			}
			
			const baseQuery = baseConditions.join(' AND ');
			
			// Time filter based on template
			let timeFilter = '';
			const timeExpression = `now("-${initialLookback}")`;
			
			switch (template) {
				case 'new_pages':
					timeFilter = `created >= ${timeExpression}`;
					triggerEventType = 'created';
					break;
				case 'updated_pages':
					timeFilter = `lastModified >= ${timeExpression}`;
					triggerEventType = 'updated';
					break;
				case 'new_or_updated_pages':
					timeFilter = `(created >= ${timeExpression} OR lastModified >= ${timeExpression})`;
					triggerEventType = 'created_or_updated';
					break;
				default:
					timeFilter = `(created >= ${timeExpression} OR lastModified >= ${timeExpression})`;
					triggerEventType = 'created_or_updated';
			}

			finalQuery = `(${baseQuery}) AND ${timeFilter}`;
		} else {
			finalQuery = this.getNodeParameter('cqlQuery') as string;
			triggerEventType = 'custom_cql';
		}

		console.log('CQL Query:', finalQuery);

		// Execute search
		const credentials = await this.getCredentials('confluenceCloudApi');
		const domain = credentials.domain as string;
		const baseUrl = `${domain}/wiki`;

		const requestOptions = {
			method: 'GET' as const,
			url: `${baseUrl}/rest/api/content/search`,
			qs: {
				cql: finalQuery,
				limit: additionalOptions.limit || 50,
				expand: 'space,version',
			},
		};

		try {
			const response = await this.helpers.requestWithAuthentication.call(
				this,
				'confluenceCloudApi',
				requestOptions,
			);

			const parsedResponse = typeof response === 'string' ? JSON.parse(response) : response;
			const results = parsedResponse.results || [];
			// Confluence content/search returns results directly, not wrapped in content property
			const pages = results.filter((item: any) => item.type === 'page');

			const newResults: INodeExecutionData[] = pages.map((page: any) => ({
				json: {
					id: page.id,
					title: page.title,
					type: page.type,
					status: page.status,
					space: {
						key: page.space?.key,
						name: page.space?.name,
						id: page.space?.id,
					},
					version: page.version,
					links: {
						webui: page._links?.webui,
						self: page._links?.self,
					},
					pollTime: new Date().toISOString(),
					triggerEvent: triggerEventType,
				},
			}));

			console.log(`Returning ${newResults.length} items`);
			return [newResults];

		} catch (error) {
			console.error('Confluence API Error:', error instanceof Error ? error.message : String(error));
			throw new NodeOperationError(
				this.getNode(),
				`Confluence API request failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
}
