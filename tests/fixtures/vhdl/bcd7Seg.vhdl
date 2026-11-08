library ieee;
use ieee.std_logic_1164.all;

-- The number on SW3..SW0 is shown as one digit on HEX0_N; SW9..SW4 are not
-- used. 0..9 show the digit and 10..15 leave the display blank.
-- (The Bab 5 sheet has no arm for 0 or 9, so both of those show blank there.)
entity bcd7Seg is
    port (
        SW     : in  std_logic_vector(9 downto 0);
        HEX0_N : out std_logic_vector(6 downto 0);
        HEX1_N : out std_logic_vector(6 downto 0);
        HEX2_N : out std_logic_vector(6 downto 0);
        HEX3_N : out std_logic_vector(6 downto 0);
        HEX4_N : out std_logic_vector(6 downto 0);
        HEX5_N : out std_logic_vector(6 downto 0)
    );
end entity bcd7Seg;

architecture rtl of bcd7Seg is

    -- Segment bits are gfedcba; a zero lights a segment.
    signal segments : std_logic_vector(6 downto 0);

begin

    process (SW(3 downto 0))
    begin
        case SW(3 downto 0) is
            when "0000" => segments <= "1000000";   -- 0
            when "0001" => segments <= "1111001";   -- 1
            when "0010" => segments <= "0100100";   -- 2
            when "0011" => segments <= "0110000";   -- 3
            when "0100" => segments <= "0011001";   -- 4
            when "0101" => segments <= "0010010";   -- 5
            when "0110" => segments <= "0000010";   -- 6
            when "0111" => segments <= "1111000";   -- 7
            when "1000" => segments <= "0000000";   -- 8
            when "1001" => segments <= "0010000";   -- 9
            when others => segments <= "1111111";   -- 10..15: blank
        end case;
    end process;

    HEX0_N <= segments;

    -- Unused displays: all segments off (active low).
    HEX1_N <= (others => '1');
    HEX2_N <= (others => '1');
    HEX3_N <= (others => '1');
    HEX4_N <= (others => '1');
    HEX5_N <= (others => '1');

end architecture rtl;
