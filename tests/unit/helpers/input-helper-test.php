<?php

namespace Yoast\WP\SEO\Tests\Unit\Helpers;

use Yoast\WP\SEO\Helpers\Input_Helper;
use Yoast\WP\SEO\Tests\Unit\TestCase;

/**
 * Class Input_Helper_Test
 *
 * @group helpers
 *
 * @coversDefaultClass \Yoast\WP\SEO\Helpers\Input_Helper
 */
class Input_Helper_Test extends TestCase {

	/**
	 * The instance to test.
	 *
	 * @var Post_Helper
	 */
	private $instance;

	/**
	 * Sets up the test class.
	 */
	public function set_up() {
		parent::set_up();

		$this->instance = new Input_Helper();
	}

	/**
	 * Tests the whether the filter_input function has been called.
	 *
	 * @covers ::filter
	 */
	public function test_filter() {
		$this->assertNull( $this->instance->filter( INPUT_POST, 'bogus', FILTER_SANITIZE_STRING ) );
	}
}
