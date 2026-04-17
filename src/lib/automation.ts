import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

interface Condition {
  field: string;
  operator: string;
  value: string;
}

interface Action {
  type: string;
  value: string;
}

interface AutomationRule {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  conditions: Condition[];
  actions: Action[];
  priority: number;
}

interface Message {
  content: string;
  channel?: string;
  customerName?: string;
}

interface Conversation {
  id: string;
  channel?: string;
  customerName?: string;
}

interface MatchedAction {
  ruleId: string;
  ruleName: string;
  type: string;
  actions: Action[];
}

interface EvaluationContext {
  businessHoursStatus: "open" | "closed";
}

interface AutomationExecutionResult {
  autoReplyMessages: string[];
}

async function getBusinessHoursStatus(): Promise<"open" | "closed"> {
  const config = await prisma.businessHours.findUnique({
    where: { id: "default" },
  });

  if (!config || !config.enabled) return "open";

  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: config.timezone || "UTC",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const weekday = parts.find((p) => p.type === "weekday")?.value?.toLowerCase();
    const hour = parts.find((p) => p.type === "hour")?.value || "00";
    const minute = parts.find((p) => p.type === "minute")?.value || "00";
    const currentTime = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;

    const daySchedule = config[weekday as keyof typeof config];
    if (typeof daySchedule !== "string" || !daySchedule) return "closed";

    const [start, end] = daySchedule.split("-");
    if (!start || !end) return "closed";

    return currentTime >= start && currentTime < end ? "open" : "closed";
  } catch (error) {
    logger.error("Failed to determine business hours status:", error);
    return "open";
  }
}

function getFieldValue(
  field: string,
  message: Message,
  conversation: Conversation,
  context: EvaluationContext
): string {
  switch (field) {
    case "message_content":
      return message.content || "";
    case "channel":
      return message.channel || conversation.channel || "";
    case "customer_name":
      return message.customerName || conversation.customerName || "";
    case "business_hours":
      return context.businessHoursStatus;
    default:
      return "";
  }
}

function evaluateCondition(
  condition: Condition,
  message: Message,
  conversation: Conversation,
  context: EvaluationContext
): boolean {
  const fieldValue = getFieldValue(
    condition.field,
    message,
    conversation,
    context
  ).toLowerCase();
  const targetValue = condition.value.toLowerCase();

  switch (condition.operator) {
    case "contains":
      return fieldValue.includes(targetValue);
    case "equals":
      return fieldValue === targetValue;
    case "starts_with":
      return fieldValue.startsWith(targetValue);
    default:
      return false;
  }
}

function ruleMatchesMessage(
  rule: AutomationRule,
  message: Message,
  conversation: Conversation,
  context: EvaluationContext
): boolean {
  if (!rule.conditions || rule.conditions.length === 0) return false;

  return rule.conditions.every((condition) =>
    evaluateCondition(condition, message, conversation, context)
  );
}

/**
 * Evaluates all active automation rules against a message and conversation.
 * Returns an array of matched actions sorted by rule priority (highest first).
 *
 * Called from the AI engine when a new message comes in.
 */
export async function evaluateRules(
  message: Message,
  conversation: Conversation
): Promise<MatchedAction[]> {
  const evaluationContext: EvaluationContext = {
    businessHoursStatus: await getBusinessHoursStatus(),
  };

  const rules = await prisma.automationRule.findMany({
    where: { isActive: true },
    orderBy: { priority: "desc" },
  });

  const matchedActions: MatchedAction[] = [];

  for (const rule of rules) {
    const conditions = rule.conditions as unknown as Condition[];
    const actions = rule.actions as unknown as Action[];

    const automationRule: AutomationRule = {
      id: rule.id,
      name: rule.name,
      type: rule.type,
      isActive: rule.isActive,
      conditions,
      actions,
      priority: rule.priority,
    };

    if (ruleMatchesMessage(automationRule, message, conversation, evaluationContext)) {
      matchedActions.push({
        ruleId: rule.id,
        ruleName: rule.name,
        type: rule.type,
        actions,
      });

      // Increment trigger count in background
      prisma.automationRule
        .update({
          where: { id: rule.id },
          data: { triggerCount: { increment: 1 } },
        })
        .catch((err) =>
          logger.error(`Failed to increment trigger count for rule ${rule.id}`, err)
        );
    }
  }

  return matchedActions;
}

function inferTicketType(text: string): string {
  const normalized = text.toLowerCase();

  if (normalized.includes("bảo hành")) return "warranty";
  if (
    normalized.includes("khiếu nại") ||
    normalized.includes("complain") ||
    normalized.includes("không hài lòng") ||
    normalized.includes("hoàn tiền")
  ) {
    return "complaint";
  }
  if (normalized.includes("đặt lịch") || normalized.includes("booking")) {
    return "booking";
  }
  if (normalized.includes("giá") || normalized.includes("báo giá") || normalized.includes("quotation")) {
    return "quotation";
  }

  return "consultation";
}

export async function executeAutomationRules(
  conversationId: string,
  matchedActions: MatchedAction[],
  messageContent: string
): Promise<AutomationExecutionResult> {
  const autoReplyMessages: string[] = [];

  for (const matched of matchedActions) {
    for (const action of matched.actions) {
      try {
        if (matched.type === "auto_tag") {
          let tag = await prisma.tag.findUnique({
            where: { name: action.value },
          });

          if (!tag) {
            tag = await prisma.tag.create({
              data: { name: action.value },
            });
          }

          await prisma.conversationTag
            .create({
              data: { conversationId, tagId: tag.id },
            })
            .catch(() => null);
          continue;
        }

        if (matched.type === "auto_route") {
          const department = await prisma.department.findFirst({
            where: {
              name: { contains: action.value, mode: "insensitive" },
            },
          });

          if (!department) continue;

          const inferredType = inferTicketType(
            `${matched.ruleName} ${action.value} ${messageContent}`
          );

          const existingTicket = await prisma.ticket.findFirst({
            where: {
              conversationId,
              status: { in: ["open", "in_progress"] },
            },
            orderBy: { createdAt: "desc" },
          });

          if (existingTicket) {
            await prisma.ticket.update({
              where: { id: existingTicket.id },
              data: {
                departmentId: department.id,
                type: inferredType,
              },
            });
          } else {
            await prisma.ticket.create({
              data: {
                conversationId,
                departmentId: department.id,
                type: inferredType,
                title: `Tự động chuyển: ${matched.ruleName}`,
                description: `Tạo tự động từ quy tắc "${matched.ruleName}" cho tin nhắn: ${messageContent}`,
                priority: inferredType === "complaint" ? "high" : "medium",
                status: "open",
              },
            });
          }

          await prisma.conversation.update({
            where: { id: conversationId },
            data: { status: "escalated" },
          });
          continue;
        }

        if (matched.type === "auto_reply" && action.value.trim()) {
          autoReplyMessages.push(action.value.trim());
          continue;
        }

        if (matched.type === "keyword_alert" && action.value.trim()) {
          await prisma.internalNote.create({
            data: {
              conversationId,
              authorName: "Automation",
              content: `Cảnh báo từ quy tắc "${matched.ruleName}": gửi thông báo tới ${action.value}`,
            },
          });
        }
      } catch (error) {
        logger.error(`Failed to execute automation rule ${matched.ruleId}:`, error);
      }
    }
  }

  return { autoReplyMessages };
}
