import { z } from "zod";
import { zodToJsonSchema } from 'zod-to-json-schema'

export const TreeNode: any = z.object({
    name: z.string({ description: '节点名称' }),
    description: z.string({ description: '节点介绍' }),
    children: z.lazy(() => z.array(TreeNode, { description: '节点子集' }).optional())
});

export const TreeNodeSchema = zodToJsonSchema(TreeNode)