<?php

namespace Yoast\WP\SEO\Services\Options;

use Yoast\WP\SEO\Exceptions\Option\Missing_Configuration_Key_Exception;
use Yoast\WP\SEO\Exceptions\Option\Unknown_Exception;
use Yoast\WP\SEO\Helpers\Validation_Helper;

/**
 * The abstract options service class.
 */
abstract class Abstract_Options_Service {

	/**
	 * Holds the name of the options row in the database.
	 *
	 * @var string
	 */
	protected $option_name;

	/**
	 * Holds the option configurations.
	 *
	 * Note that if one "type check" passes, the whole option validation passes.
	 *
	 * <code>
	 * $options = [
	 *    'name' => [                                   // The name of the option field in the database.
	 *        'default'    => 'value',                  // The default value.
	 *        'types'      => [ 'empty_string', 'url' ] // Which validators to use.
	 *        'ms_exclude' => false,                    // Whether to exclude from multisite. Optional, defaults to
	 *                                                  // false.
	 *    ],
	 * ];
	 * </code>
	 *
	 * @var array[string]
	 */
	protected $configurations = [];

	/**
	 * Holds the cached option configurations.
	 *
	 * @var array[string]
	 */
	protected $cached_configurations = null;

	/**
	 * Holds the cached option values.
	 *
	 * @var array
	 */
	protected $cached_values = null;

	/**
	 * Holds the cached option default values.
	 *
	 * @var array
	 */
	protected $cached_defaults = null;

	/**
	 * Holds the validation helper instance.
	 *
	 * @var Validation_Helper
	 */
	protected $validation_helper;

	/**
	 * Constructs an options service instance.
	 *
	 * @param Validation_Helper $validation_helper The validation helper.
	 */
	public function __construct( Validation_Helper $validation_helper ) {
		$this->validation_helper = $validation_helper;
	}

	/**
	 * Magic getter to get the option value.
	 *
	 * @param string $key The option key.
	 *
	 * @throws Unknown_Exception When the option does not exist.
	 *
	 * @return mixed The option value.
	 */
	public function __get( $key ) {
		if ( \array_key_exists( $key, $this->get_values() ) ) {
			return $this->get_values()[ $key ];
		}

		throw new Unknown_Exception( $key );
	}

	/*
	 * phpcs:disable Squiz.Commenting.FunctionCommentThrowTag.WrongNumber -- Reason: see below.
	 *
	 * This sniff does not detect the exception that can be re-thrown in the validation helper,
	 * making the expected count one less than it is.
	 * This is expected behavior, as the sniff does not trace variables.
	 * @link https://github.com/squizlabs/PHP_CodeSniffer/issues/2683#issuecomment-718271057
	 */

	/**
	 * Magic setter to set the option value.
	 *
	 * @param string $key   The option key.
	 * @param mixed  $value The option value.
	 *
	 * @throws Unknown_Exception When the option does not exist.
	 * @throws Missing_Configuration_Key_Exception When the option does not have a `sanitize_as` key.
	 * @throws \Yoast\WP\SEO\Exceptions\Validation\Abstract_Validation_Exception When the value is invalid.
	 */
	public function __set( $key, $value ) {
		if ( ! \array_key_exists( $key, $this->configurations ) ) {
			throw new Unknown_Exception( $key );
		}

		// Presuming the default is safe.
		if ( $value === $this->configurations[ $key ]['default'] ) {
			$this->set_option( $key, $value );

			return;
		}
		// Only update when changed.
		if ( $value === $this->get_values()[ $key ] ) {
			return;
		}

		if ( ! \array_key_exists( 'types', $this->configurations[ $key ] ) ) {
			/*
			 * Note: this path is untested as it is configuration which is not exposed.
			 * In theory this makes this a development only exception, until we add a filter for it.
			 */
			throw new Missing_Configuration_Key_Exception( $key, 'types' );
		}
		// Validate, this can throw a Validation_Exception.
		$value = $this->validation_helper->validate_as( $value, $this->configurations[ $key ]['types'] );

		$this->set_option( $key, $value );
	}

	// phpcs:enable Squiz.Commenting.FunctionCommentThrowTag.WrongNumber

	/**
	 * Retrieves the options.
	 *
	 * @param string[] $keys Optionally request only these options.
	 *
	 * @return array The options.
	 */
	public function get_options( array $keys = [] ) {
		// Return all values if no filter is given.
		if ( \count( $keys ) === 0 ) {
			return $this->get_values();
		}

		// Return the values if the key is requested.
		return \array_filter(
			$this->get_values(),
			static function ( $key ) use ( $keys ) {
				return \in_array( $key, $keys, true );
			},
			ARRAY_FILTER_USE_KEY
		);
	}

	/**
	 * Saves the options if the database row does not exist.
	 *
	 * @return void
	 */
	public function ensure_options() {
		if ( ! \get_option( $this->option_name ) ) {
			\update_option( $this->option_name, $this->get_values() );
		}
	}

	/**
	 * Saves the options with their default values.
	 *
	 * @return void
	 */
	public function reset_options() {
		\update_option( $this->option_name, $this->get_defaults() );
	}

	/**
	 * Retrieves the default option values.
	 *
	 * @return array The default values.
	 */
	public function get_defaults() {
		if ( $this->cached_defaults === null ) {
			$this->cached_defaults = \array_combine(
				\array_keys( $this->get_configurations() ),
				\array_column( $this->get_configurations(), 'default' )
			);
		}

		return $this->cached_defaults;
	}

	/**
	 * Retrieves the default option value.
	 *
	 * @param string $key The option key.
	 *
	 * @throws Unknown_Exception When the option does not exist.
	 *
	 * @return mixed The default value.
	 */
	public function get_default( $key ) {
		if ( ! \array_key_exists( $key, $this->get_defaults() ) ) {
			throw new Unknown_Exception( $key );
		}

		return $this->get_defaults()[ $key ];
	}

	/**
	 * Retrieves the (cached) values.
	 *
	 * @return array The values.
	 */
	protected function get_values() {
		if ( $this->cached_values === null ) {
			$this->cached_values = \get_option( $this->option_name );
			// Database row does not exist. We need an array.
			if ( ! $this->cached_values ) {
				$this->cached_values = [];
			}

			// Fill with default value when the database value is missing.
			$defaults = $this->get_defaults();
			foreach ( $defaults as $option => $default_value ) {
				if ( ! \array_key_exists( $option, $this->cached_values ) ) {
					$this->cached_values[ $option ] = $default_value;
				}
			}
		}

		return $this->cached_values;
	}

	/**
	 * Retrieves the (cached) option configurations.
	 *
	 * @return array The option configurations.
	 */
	public function get_configurations() {
		if ( $this->cached_configurations === null ) {
			$this->cached_configurations = $this->configurations;
		}

		return $this->cached_configurations;
	}

	/**
	 * Clears the cache.
	 *
	 * @return void
	 */
	public function clear_cache() {
		$this->cached_configurations = null;
		$this->cached_defaults       = null;
		$this->cached_values         = null;
	}

	/**
	 * Sets an option value, without checks.
	 *
	 * @param string $key   The option key.
	 * @param mixed  $value The option value.
	 *
	 * @return void
	 */
	protected function set_option( $key, $value ) {
		// Ensure the cache is filled.
		if ( $this->cached_values === null ) {
			$this->get_values();
		}

		// Only save when changed.
		if ( $value === $this->cached_values[ $key ] ) {
			return;
		}

		// Update the cache.
		$this->cached_values[ $key ] = $value;
		// Save to the database.
		\update_option( $this->option_name, $this->cached_values );
	}
}
