// Learn more at developers.reddit.com/docs
import { Devvit, useAsync, useInterval, useState } from '@devvit/public-api';

Devvit.configure({
  redditAPI: true,
  redis: true,
});

// Add a menu item to the subreddit menu for instantiating the new experience post
Devvit.addMenuItem({
  label: 'Add useAsync Test',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    const { reddit, ui } = context;
    const subreddit = await reddit.getCurrentSubreddit();
    await reddit.submitPost({
      title: 'useAsync Test',
      subredditName: subreddit.name,
      // The preview appears while the post loads
      preview: (
        <vstack height="100%" width="100%" alignment="middle center">
          <text size="large">Loading ...</text>
        </vstack>
      ),
    });
    ui.showToast({ text: 'Created post!' });
  },
});

// Add a post type definition
Devvit.addCustomPostType({
  name: 'useAsync Test',
  height: 'regular',
  render: (context) => {
    // #region Async redis work

    // Save a unique counter per user, per post
    const redisCounterKey = `counter:${context.postId}:${context.userId}`;

    // Load the current counter value and save in a variable for rendering
    const [redisCounter, setRedisCounter] = useState(async () => {
      const currentValue = await context.redis.get(redisCounterKey);
      if (currentValue == undefined) {
        await context.redis.set(redisCounterKey, '0');
        return 0;
      }
      return currentValue;
    });
    // Restart the useAsync task every time this value increments
    const [redisCounterTick, setRedisCounterTick] = useState(0);
    // Save the loading state in a state variable so we can react to the loading state changing
    const [redisIncrLoading, setRedisIncrLoading] = useState(false);

    // Setup a timer to increment the tick counter which will restart the useAsync task
    const redisCounterTimer = useInterval(() => {
      redisCounterTimer.stop();
      setRedisCounterTick(t => t + 1);
    }, 1000);

    // Increment the redis counter in a useAsync() hook so it runs parallel to the render loop
    const redisCounterIncr = useAsync(async () => {
      // Don't modify state inside the useAsync() closure! It's thrown out by the runtime.
      return await context.redis.incrBy(redisCounterKey, 1);
    },
      // Restart when this value changes
      { depends: redisCounterTick }
    );

    if (redisCounterIncr.loading != redisIncrLoading) {
      // Keep redisCounterIncr in sync with the useAsync loading state.
      // NOTE: This won't update redisCounterIncr until next frame! We rely on this quirk here.
      //       (see: https://react.dev/reference/react/useState#ive-updated-the-state-but-logging-gives-me-the-old-value)
      setRedisIncrLoading(redisCounterIncr.loading);
    }

    // Only on the frame that useAsync completed will these be out of sync
    const loadingCompleteThisFrame = !redisCounterIncr.loading && redisIncrLoading;

    // If useAsync is done, there are no errors, and data was returned
    if (loadingCompleteThisFrame && !redisCounterIncr.error && redisCounterIncr.data) {
      // Update the value to render later...
      setRedisCounter(redisCounterIncr.data);
      // ...and kick off our 1-second countdown before incrementing again
      redisCounterTimer.start();
    }

    // #endregion


    // #region UI rendering work

    // Simple interval-based counter, used to force a high rate of client-side renders
    const [counter, setCounter] = useState(0);
    const counterInterval = useInterval(() => setCounter(c => c + 1), 16);
    counterInterval.start();

    // Animate the counter as a smooth value from 0 - 100 to show as a progress bar bouncing back and forth
    const progress = (Math.cos((counter / 360) * (2 * Math.PI)) * 50) + 50;

    // #endregion

    return (
      <vstack height="100%" width="100%" gap="medium" alignment="center middle">
        <text size="medium">{`Async Counter: ${redisCounter}`}</text>
        <vstack backgroundColor='#FFD5C6' cornerRadius='full' width='100%'>
          <hstack backgroundColor='#D93A00' width={`${progress}%`}>
            <spacer size='medium' shape='square' />
          </hstack>
        </vstack>
      </vstack>
    );
  },
});

export default Devvit;
