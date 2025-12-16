import Anthropic from '@anthropic-ai/sdk';

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'get_holdings',
    description:
      'Retrieve crypto holdings for a specific snapshot date. If no date is provided, returns the most recent holdings.',
    input_schema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description:
            'The snapshot date in YYYY-MM-DD format. Omit to get the latest holdings.',
        },
      },
    },
  },
  {
    name: 'calculate_portfolio_value',
    description:
      'Calculate the total portfolio value in EUR for a specific date or current holdings.',
    input_schema: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description:
            'The date for valuation in YYYY-MM-DD format. Omit for current value.',
        },
      },
    },
  },
  {
    name: 'get_historical_price',
    description: 'Get the historical price of a crypto asset on a specific date.',
    input_schema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'The crypto asset symbol (e.g., BTC, ETH)',
        },
        date: {
          type: 'string',
          description: 'The date in YYYY-MM-DD format',
        },
      },
      required: ['symbol', 'date'],
    },
  },
  {
    name: 'list_snapshots',
    description: 'List all available portfolio snapshots with their dates.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
];

export const SYSTEM_PROMPT = `You are a helpful assistant for a crypto portfolio tracking application.

You have access to a database of monthly portfolio snapshots and historical price data. Users can ask questions about their crypto holdings, portfolio value, and performance.

When users ask questions:
- Use the appropriate tools to fetch the required data
- Perform calculations when needed
- Present information clearly and concisely
- Format numbers with appropriate decimal places
- Include currency symbols (€ for EUR)
- Provide context when helpful

Available data:
- Monthly snapshots of crypto holdings (amount of each asset)
- Historical price data in EUR
- Current portfolio composition

Be helpful, accurate, and professional in your responses.`;

export class ClaudeService {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string = 'claude-haiku-4-5') {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async processQuery(
    userQuery: string,
    toolExecutor: (toolName: string, toolInput: any) => Promise<any>
  ): Promise<string> {
    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: userQuery,
      },
    ];

    let response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: TOOL_DEFINITIONS,
      messages,
    });

    // Handle tool use loop
    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        try {
          const result = await toolExecutor(toolUse.name, toolUse.input);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
          });
        } catch (error) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
            }),
            is_error: true,
          });
        }
      }

      // Add assistant message and tool results to conversation
      messages.push({
        role: 'assistant',
        content: response.content,
      });

      messages.push({
        role: 'user',
        content: toolResults,
      });

      // Get next response
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: TOOL_DEFINITIONS,
        messages,
      });
    }

    // Extract text from final response
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    );

    return textBlocks.map((block) => block.text).join('\n');
  }
}
