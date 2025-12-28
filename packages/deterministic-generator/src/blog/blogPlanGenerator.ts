/**
 * Blog Plan Generator
 * 
 * Generates blog_index and blog_post pages with proper linking structure
 */

import OpenAI from 'openai';
import { SiteInput, Blueprint, BlogPlan } from '../types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate blog plan from site input and blueprint
 */
export async function generateBlogPlan(
  siteInput: SiteInput,
  blueprint: Blueprint
): Promise<BlogPlan> {
  if (!siteInput.blog?.enabled) {
    throw new Error('Blog is not enabled in site input');
  }

  const numPosts = siteInput.blog.num_posts || 6;
  const primaryService = siteInput.primary_service;
  const targetCity = siteInput.target_city;
  const state = siteInput.state;

  // Get service pages for linking
  const servicePages = blueprint.pages.filter(p => p.page_type === 'service');
  const primaryServicePage = servicePages.find(p => p.service === primaryService) || servicePages[0];
  const contactSlug = '/contact';

  // Generate blog post ideas using GPT
  const blogPostIdeas = await generateBlogPostIdeas(
    primaryService,
    targetCity,
    state,
    numPosts,
    siteInput.blog.avoid_topics || []
  );

  // Build blog plan
  const posts = blogPostIdeas.map((idea, index) => {
    // Determine related post (link to previous post if not first)
    const relatedPostSlug = index > 0 ? blogPostIdeas[index - 1].slug : null;

    return {
      slug: idea.slug,
      title: idea.title,
      primary_keyword: idea.primary_keyword,
      intent: idea.intent,
      links_to: {
        service_slug: primaryServicePage?.slug || '/',
        contact_slug: contactSlug,
        related_post_slug: relatedPostSlug,
      },
    };
  });

  return {
    blog_index: {
      slug: '/blog',
    },
    posts,
  };
}

interface BlogPostIdea {
  slug: string;
  title: string;
  primary_keyword: string;
  intent: string;
}

/**
 * Generate blog post ideas using GPT
 */
async function generateBlogPostIdeas(
  primaryService: string,
  targetCity: string,
  state: string,
  numPosts: number,
  avoidTopics: string[]
): Promise<BlogPostIdea[]> {
  const prompt = `You are a local SEO content strategist.

Task: Generate ${numPosts} blog post ideas for a ${primaryService} business in ${targetCity}, ${state}.

ABSOLUTE RULES:
- Output JSON only (no markdown, no commentary)
- Each post must target a different informational keyword
- Posts should answer common questions about ${primaryService}
- Avoid these topics: ${avoidTopics.join(', ') || 'none'}
- Use local context (${targetCity}, ${state}) naturally
- Each post must be linkable to the main service page

OUTPUT FORMAT:
{
  "posts": [
    {
      "slug": "/blog/post-slug-here",
      "title": "Post Title Here",
      "primary_keyword": "informational keyword phrase",
      "intent": "informational"
    }
  ]
}

Generate exactly ${numPosts} posts.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a local SEO content strategist. Output only valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    if (Array.isArray(parsed.posts)) {
      return parsed.posts.slice(0, numPosts).map((post: any) => ({
        slug: post.slug || `/blog/${post.title?.toLowerCase().replace(/\s+/g, '-') || 'post'}`,
        title: post.title || 'Untitled Post',
        primary_keyword: post.primary_keyword || `${primaryService} ${targetCity}`,
        intent: post.intent || 'informational',
      }));
    }

    // Fallback: generate simple posts
    return generateFallbackBlogPosts(primaryService, targetCity, state, numPosts);
  } catch (error) {
    console.error('Error generating blog post ideas:', error);
    return generateFallbackBlogPosts(primaryService, targetCity, state, numPosts);
  }
}

/**
 * Generate fallback blog posts if GPT fails
 */
function generateFallbackBlogPosts(
  primaryService: string,
  targetCity: string,
  state: string,
  numPosts: number
): BlogPostIdea[] {
  const templates = [
    { keyword: `how to choose ${primaryService}`, intent: 'informational' },
    { keyword: `${primaryService} cost guide`, intent: 'informational' },
    { keyword: `signs you need ${primaryService}`, intent: 'informational' },
    { keyword: `${primaryService} maintenance tips`, intent: 'informational' },
    { keyword: `best ${primaryService} practices`, intent: 'informational' },
    { keyword: `${primaryService} safety guide`, intent: 'informational' },
  ];

  return templates.slice(0, numPosts).map((template, index) => {
    const slug = `/blog/${template.keyword.replace(/\s+/g, '-')}`;
    const title = template.keyword
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    return {
      slug,
      title,
      primary_keyword: `${template.keyword} ${targetCity} ${state}`,
      intent: template.intent,
    };
  });
}

