import { useEffect, useState } from 'react';
import Head from 'next/head';

export default function Home() {
  const [stats, setStats] = useState(null);
  const [config, setConfig] = useState({
    postingEnabled: process.env.ENABLE_AUTO_POSTING === 'true',
    aiEnabled: process.env.ENABLE_AI_DESCRIPTIONS === 'true',
    postingInterval: process.env.POSTING_INTERVAL_MINUTES || '30'
  });

  useEffect(() => {
    // This would fetch queue stats in a full implementation
    setStats({
      totalItems: 0,
      pendingItems: 0,
      processingItems: 0,
      failedItems: 0
    });
  }, []);

  return (
    <div className="container">
      <Head>
        <title>MillenialDaddy - Instagram Automation</title>
        <meta name="description" content="Instagram content automation system" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        <h1>MillenialDaddy</h1>
        <p>Instagram content automation system</p>

        <div className="status">
          <h2>System Status</h2>
          <ul>
            <li>
              Auto-posting: <span className={config.postingEnabled ? 'enabled' : 'disabled'}>
                {config.postingEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </li>
            <li>
              AI Descriptions: <span className={config.aiEnabled ? 'enabled' : 'disabled'}>
                {config.aiEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </li>
            <li>
              Posting Interval: <span className="info">Every {config.postingInterval} minutes</span>
            </li>
          </ul>
        </div>

        {stats && (
          <div className="queue">
            <h2>Queue Status</h2>
            <ul>
              <li>Total Items: {stats.totalItems}</li>
              <li>Pending: {stats.pendingItems}</li>
              <li>Processing: {stats.processingItems}</li>
              <li>Failed: {stats.failedItems}</li>
            </ul>
          </div>
        )}
      </main>

      <style jsx>{`
        .container {
          min-height: 100vh;
          padding: 0 0.5rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          background: #f5f5f5;
        }

        main {
          padding: 5rem 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          max-width: 800px;
          width: 100%;
        }

        h1 {
          margin: 0;
          line-height: 1.15;
          font-size: 4rem;
          text-align: center;
        }

        p {
          text-align: center;
          line-height: 1.5;
          font-size: 1.5rem;
          color: #666;
        }

        .status, .queue {
          margin-top: 2rem;
          padding: 1.5rem;
          width: 100%;
          background: white;
          border-radius: 10px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        h2 {
          margin: 0 0 1rem 0;
          font-size: 1.5rem;
          color: #333;
        }

        ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        li {
          padding: 0.5rem 0;
          font-size: 1.1rem;
          color: #444;
        }

        .enabled {
          color: #2ecc71;
          font-weight: bold;
        }

        .disabled {
          color: #e74c3c;
          font-weight: bold;
        }

        .info {
          color: #3498db;
          font-weight: bold;
        }
      `}</style>

      <style jsx global>{`
        html,
        body {
          padding: 0;
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen,
            Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue, sans-serif;
        }

        * {
          box-sizing: border-box;
        }
      `}</style>
    </div>
  );
}
