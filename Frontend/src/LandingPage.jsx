import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import './LandingPage.css';

function LandingPage() {
  const navigate = useNavigate();

  const containerRef = useRef(null);

  const handleTryNow = () => {
    navigate('/review');
  };

  useGSAP(() => {
    const tl = gsap.timeline();
    
    tl.from('.navbar', { y: -50, opacity: 0, duration: 0.6, ease: 'power3.out' })
      .from('.trust-badge', { y: 20, opacity: 0, duration: 0.5, ease: 'power2.out' }, '-=0.3')
      .from('.main-title', { y: 20, opacity: 0, duration: 0.5, ease: 'power2.out' }, '-=0.3')
      .from('.main-subtitle', { y: 20, opacity: 0, duration: 0.5, ease: 'power2.out' }, '-=0.3')
      .from('.editor-mockup', { y: 40, opacity: 0, duration: 0.7, ease: 'power3.out' }, '-=0.2')
      .from('.features-grid > div', { y: 30, opacity: 0, duration: 0.5, stagger: 0.1, ease: 'power2.out' }, '-=0.4')
      .from('.testimonials-section', { opacity: 0, duration: 0.6, ease: 'power2.out' }, '-=0.2');
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className="landing-page-light">
      <nav className="navbar">
        <div className="logo">CodeReviewer</div>
        <button className="nav-cta" onClick={handleTryNow}>
          Start for Free <span className="arrow">→</span>
        </button>
      </nav>

      <main className="hero-section">
        <div className="trust-badge">
          <div className="avatars">
            
          </div>
          <div className="trust-content">
            
            <span className="practice-text">used for practice purpose</span>
          </div>
        </div>

        <h1 className="main-title">
          Review Code Instantly <br /> Fix Bugs Instantly
        </h1>

        <p className="main-subtitle">
          Paste your code, get actionable feedback and refactored snippets in seconds
        </p>

        

        <div className="editor-mockup">
          <div className="editor-header">
            <div className="dots">
              <span className="dot red"></span>
              <span className="dot yellow"></span>
              <span className="dot green"></span>
            </div>
            <div className="editor-tab">app.js</div>
          </div>
          <div className="editor-body">
            <pre>
              <code>
                <span className="keyword">function</span> <span className="function">processData</span>(items) {'{\n'}
                {'  '}<span className="keyword">let</span> result = [];{'\n'}
                {'  '}<span className="keyword">for</span> (<span className="keyword">let</span> i = 0; i {'<'} items.length; i++) {'{\n'}
                {'    '}<span className="comment">// AI: Use .map() for cleaner and faster execution</span>{'\n'}
                {'    '}result.<span className="function">push</span>(items[i].<span className="function">transform</span>());{'\n'}
                {'  }\n'}
                {'  '}<span className="keyword">return</span> result;{'\n'}
                {'}'}
              </code>
            </pre>
            <div className="ai-popover">
              <i className="ri-magic-line"></i>
              <span><strong>Optimization found:</strong> Replace loop with Array.map()</span>
            </div>
          </div>
        </div>
        <div className="cta-container">
          <button className="main-cta" onClick={handleTryNow}>
            Start for Free <span className="arrow">→</span>
          </button>
          <p className="cta-subtext">Unlimited free reviews included</p>
        </div>

        <div className="features-section">
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon"><i className="ri-flashlight-line"></i></div>
              <h3>Instant Feedback</h3>
              <p>Get immediate insights on bugs, security vulnerabilities, and performance bottlenecks without waiting on a human reviewer.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><i className="ri-magic-line"></i></div>
              <h3>AI Refactoring</h3>
              <p>Don't just find problems. Automatically receive refactored, clean, and optimized code snippets ready to be copied.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon"><i className="ri-bar-chart-box-line"></i></div>
              <h3>Structured Reports</h3>
              <p>Reviews are organized into clear, actionable sections. See exactly what passed, what needs work, and your overall score.</p>
            </div>
          </div>
        </div>

        <div className="testimonials-section">
          <div className="testimonials-header">
            <span className="ribbon">🏆</span>
            What developers say about us
            <span className="ribbon">🏆</span>
          </div>

          <div className="testimonials-grid">
            <div className="testimonial-card">
              We tested our code early and caught critical bugs before merging to production.
            </div>
            <div className="testimonial-card">
              CodeReviewer saved us over 10 hours a week in manual code reviews without spending upfront.
            </div>
            <div className="testimonial-card">
              It helped us cut our review time in half while validating what actually works before shipping.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default LandingPage;
